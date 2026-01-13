
import { 
  Member, 
  LedgerEntry, 
  Payment, 
  Expense, 
  DueConfig, 
  AuditLog, 
  MemberStatus, 
  UserRole, 
  PaymentStatus, 
  ExpenseStatus, 
  DueType, 
  BillingFrequency, 
  PostingType,
  LedgerStatus
} from '../types';

const API_URL = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3005/api';

// Cache structure
interface Cache {
  member: Member[];
  payment: Payment[];
  ledger_entry: LedgerEntry[];
  expense: Expense[];
  dues_config: DueConfig[];
  audit_log: AuditLog[];
  [key: string]: any[];
}

type Listener = () => void;

export const StorageService = {
  isReady: false,
  isPolling: false,
  listeners: [] as Listener[],

  subscribe: (listener: Listener) => {
    StorageService.listeners.push(listener);
    return () => {
      StorageService.listeners = StorageService.listeners.filter(l => l !== listener);
    };
  },

  notify: () => {
    StorageService.listeners.forEach(l => l());
  },

  cache: {
    member: [],
    payment: [],
    ledger_entry: [],
    expense: [],
    dues_config: [],
    audit_log: []
  } as Cache,

  init: async () => {
    if (StorageService.isReady) return;

    // Start polling immediately to ensure we keep trying even if initial sync fails
    if (!StorageService.isPolling) {
      StorageService.isPolling = true;
      setInterval(() => {
        StorageService.sync().catch(console.error);
      }, 5000);
    }

    try {
      await StorageService.sync();
      StorageService.isReady = true;
      
      // Check and apply annual dues on startup
      await StorageService.checkAndApplyAnnualDues();

    } catch (err) {
      console.error("StorageService.init failed:", err);
      // Fallback or retry logic could go here
    }
  },

  sync: async () => {
    try {
      const token = localStorage.getItem('u48_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/sync`, { headers }).catch(() => null);
      if (!res) {
        console.warn("Backend not reachable");
        return;
      }
      if (res.status === 401) {
         console.warn("Sync unauthorized - Session may be expired");
         return;
      }
      if (!res.ok) throw new Error('Failed to sync data');
      const data = await res.json();
      StorageService.cache = data;
      StorageService.notify();
      // console.log('Data synced:', data);
    } catch (e) {
      console.error("Sync error:", e);
    }
  },

  save: () => {
    // No-op: Data is saved to backend immediately on write
  },

  // Schema creation is handled by backend
  createSchema: () => {},
  seedData: () => {},
  ensureSeeded: () => {},

  getData: <T>(tableName: string): T[] => {
    // Map table names to cache keys
    const tableMap: Record<string, string> = {
      'u48_ledger': 'ledger_entry',
      'u48_expenses': 'expense',
      'u48_audit': 'audit_log',
      'u48_dues': 'dues_config',
      'member': 'member',
      'payment': 'payment',
      'expense': 'expense',
      'ledger_entry': 'ledger_entry',
      'audit_log': 'audit_log',
      'dues_config': 'dues_config'
    };
    const key = tableMap[tableName] || tableName;
    return (StorageService.cache[key] || []) as T[];
  },

  getMembers: (): Member[] => {
    const members = StorageService.getData<Member>('member');
    const ledger = StorageService.getData<LedgerEntry>('ledger_entry');
    const currentYear = new Date().getFullYear();

    return members.map(m => {
      // Reimplement SQL logic in JS
      // Filter for Current Year only to ensure previous year payments/debts do not affect current year status
      const memberEntries = ledger.filter(l => l.memberId === m.id);
      
      // Calculate Current Year Balance (Strict Isolation)
      const currentYearEntries = memberEntries.filter(l => 
        (l.appliedFinancialYear || new Date(l.effectiveDate || l.entryDate).getFullYear()) === currentYear
      );
      
      const currentPaymentsSum = currentYearEntries
        .filter(l => l.creditAccountId.startsWith('acc-member'))
        .reduce((sum, l) => sum + l.amount, 0);
        
      const currentDebitsSum = currentYearEntries
        .filter(l => l.debitAccountId.startsWith('acc-member'))
        .reduce((sum, l) => sum + l.amount, 0);
      
      const ledgerBalance = currentPaymentsSum - currentDebitsSum;

      // Calculate Arrears Balance (Strict Isolation)
      // Sum of balances for all years < currentYear
      const arrearsEntries = memberEntries.filter(l => 
        (l.appliedFinancialYear || new Date(l.effectiveDate || l.entryDate).getFullYear()) < currentYear
      );

      const arrearsPaymentsSum = arrearsEntries
        .filter(l => l.creditAccountId && l.creditAccountId.startsWith('acc-member'))
        .reduce((sum, l) => sum + l.amount, 0);

      const arrearsDebitsSum = arrearsEntries
        .filter(l => l.debitAccountId && l.debitAccountId.startsWith('acc-member'))
        .reduce((sum, l) => sum + l.amount, 0);

      const arrearsBalance = arrearsPaymentsSum - arrearsDebitsSum;
      
      // Previous balance is historic and ignored for current year isolation
      return { ...m, balance: ledgerBalance, arrearsBalance };
    });
  },

  getPayments: (): Payment[] => {
    return StorageService.getData<Payment>('payment');
  },

  getExpenses: (): Expense[] => {
    return StorageService.getData<Expense>('expense');
  },

  updateMember: async (member: Member) => {
    try {
      // Remove derived fields that shouldn't be sent to backend
      const { balance, arrearsBalance, ...memberData } = member;

      const res = await fetch(`${API_URL}/member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });
      if (!res.ok) throw new Error('Failed to update member');
      
      await StorageService.sync();
      StorageService.logAudit(member.id, 'UPDATE_MEMBER', 'MEMBER', member.id);
    } catch (e) {
      console.error("updateMember failed:", e);
      throw e; // Propagate error so caller knows it failed
    }
  },

  deleteMember: async (memberId: string) => {
    try {
        await fetch(`${API_URL}/member/${memberId}`, { method: 'DELETE' });
        await StorageService.sync();
        StorageService.logAudit('SYSTEM', 'DELETE_MEMBER', 'MEMBER', memberId);
    } catch (e) {
        console.error("deleteMember failed:", e);
    }
  },

  addPayment: async (payment: Payment, adminId: string) => {
    try {
        await fetch(`${API_URL}/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payment)
        });
        
        if (payment.status === PaymentStatus.VERIFIED) {
             await StorageService.postPaymentToLedger(payment);
        }
        
        await StorageService.sync();
        StorageService.logAudit(adminId, 'RECORD_PAYMENT', 'PAYMENT', payment.id);
    } catch (e) {
        console.error("addPayment failed:", e);
    }
  },

  verifyPayment: async (paymentId: string, adminId: string) => {
    try {
        await fetch(`${API_URL}/payment/${paymentId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: PaymentStatus.VERIFIED })
        });
        
        // Fetch payment to post to ledger
        // We can use sync and find it, or fetch from API. 
        // Sync is easier to keep cache consistent.
        await StorageService.sync();
        const payment = StorageService.getData<Payment>('payment').find(p => p.id === paymentId);
        
        if (payment) {
            await StorageService.postPaymentToLedger(payment);
            await StorageService.sync();
        }
        
        StorageService.logAudit(adminId, 'VERIFY_PAYMENT', 'PAYMENT', paymentId);
    } catch (e) {
        console.error("verifyPayment failed:", e);
    }
  },

  reversePayment: async (paymentId: string, adminId: string, reason: string) => {
    try {
        await fetch(`${API_URL}/payment/${paymentId}/reverse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId, reason })
        });
        
        await StorageService.sync();
        StorageService.logAudit(adminId, 'REVERSE_PAYMENT', 'PAYMENT', paymentId);
    } catch (e) {
        console.error("reversePayment failed:", e);
        throw e;
    }
  },

  deletePayment: async (paymentId: string) => {
    try {
        await fetch(`${API_URL}/payment/${paymentId}`, {
            method: 'DELETE'
        });
        await StorageService.sync();
    } catch (e) {
        console.error("deletePayment failed:", e);
        throw e;
    }
  },

  reclassifyPayment: async (paymentId: string, adminId: string, reason: string, newDate: string, newFinancialYear?: number) => {
    try {
        await fetch(`${API_URL}/payment/${paymentId}/reclassify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId, reason, newDate, newFinancialYear })
        });
        
        await StorageService.sync();
        StorageService.logAudit(adminId, 'RECLASSIFY_PAYMENT', 'PAYMENT', paymentId);
    } catch (e) {
        console.error("reclassifyPayment failed:", e);
        throw e;
    }
  },

  postPaymentToLedger: async (payment: Payment) => {
    const id = `l-pay-${Date.now()}`;
    const currentYear = new Date().getFullYear();
    const appliedYear = payment.appliedFinancialYear || new Date(payment.paymentDate).getFullYear();
    const isArrears = appliedYear < currentYear;

    const entry: LedgerEntry = {
        id,
        entryDate: payment.paymentDate,
        effectiveDate: payment.paymentDate,
        description: `Payment (${payment.paymentType || 'General'}): ${payment.referenceNumber}${payment.notes ? ` - ${payment.notes}` : ''}`,
        debitAccountId: 'acc-bank',
        creditAccountId: isArrears ? 'acc-member-arrears' : 'acc-member-receivable',
        amount: payment.amount,
        memberId: payment.memberId,
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        createdAt: new Date().toISOString(),
        appliedFinancialYear: appliedYear,
        postingYear: currentYear,
        postingType: isArrears ? PostingType.ARREARS_SETTLEMENT : PostingType.PAYMENT,
        category: 'DUES',
        status: LedgerStatus.POSTED
    };
    
    await fetch(`${API_URL}/ledger_entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    });
  },

  postReversalToLedger: async (payment: Payment, reason: string) => {
    const id = `l-rev-${Date.now()}`;
    const currentYear = new Date().getFullYear();
    const appliedYear = payment.appliedFinancialYear || new Date(payment.paymentDate).getFullYear();
    const isArrears = appliedYear < currentYear;

    const entry: LedgerEntry = {
        id,
        entryDate: new Date().toISOString().split('T')[0], // Reversal date is today
        effectiveDate: payment.paymentDate,
        description: `REVERSAL of Payment ${payment.referenceNumber}: ${reason}`,
        debitAccountId: isArrears ? 'acc-member-arrears' : 'acc-member-receivable',
        creditAccountId: 'acc-bank',
        amount: payment.amount,
        memberId: payment.memberId,
        referenceType: 'PAYMENT_REVERSAL',
        referenceId: payment.id,
        createdAt: new Date().toISOString(),
        appliedFinancialYear: appliedYear,
        postingYear: currentYear,
        postingType: PostingType.REVERSAL,
        category: 'DUES',
        status: LedgerStatus.POSTED
    };
    
    await fetch(`${API_URL}/ledger_entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    });
  },

  postExpenseToLedger: async (expense: Expense) => {
    const id = `l-exp-${Date.now()}`;
    const currentYear = new Date().getFullYear();
    const appliedYear = new Date(expense.incurredDate).getFullYear();

    const entry: LedgerEntry = {
        id,
        entryDate: expense.incurredDate,
        effectiveDate: expense.incurredDate,
        description: `Expense: ${expense.title} (${expense.category})`,
        debitAccountId: `acc-expense-${expense.category.toLowerCase()}`,
        creditAccountId: 'acc-bank',
        amount: expense.amount,
        memberId: expense.submittedBy,
        referenceType: 'EXPENSE',
        referenceId: expense.id,
        createdAt: new Date().toISOString(),
        appliedFinancialYear: appliedYear,
        postingYear: currentYear,
        postingType: PostingType.EXPENSE,
        category: expense.category,
        status: LedgerStatus.POSTED
    };
    
    await fetch(`${API_URL}/ledger_entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    });
  },

  addExpense: async (expense: Expense, userId: string) => {
    try {
        await fetch(`${API_URL}/expense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expense)
        });
        await StorageService.sync();
        StorageService.logAudit(userId, 'SUBMIT_EXPENSE', 'EXPENSE', expense.id);
    } catch (e) {
        console.error("addExpense failed:", e);
    }
  },

  updateExpenseStatus: async (expenseId: string, status: ExpenseStatus, adminId: string) => {
    try {
        await fetch(`${API_URL}/expense/${expenseId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        await StorageService.sync();

        // Post to ledger if PAID
        if (status === ExpenseStatus.PAID) {
            const expense = StorageService.getExpenses().find(e => e.id === expenseId);
            if (expense) {
                await StorageService.postExpenseToLedger(expense);
                await StorageService.sync();
            }
        }

        StorageService.logAudit(adminId, `EXPENSE_${status}`, 'EXPENSE', expenseId);
    } catch (e) {
        console.error("updateExpenseStatus failed:", e);
    }
  },

  checkAndApplyAnnualDues: async () => {
    // This requires checking ledger. 
    // We can use cache.
    const currentYear = new Date().getFullYear();
    const ledger = StorageService.getData<LedgerEntry>('ledger_entry');
    const hasAssessment = ledger.some(l => 
        l.postingType === PostingType.CURRENT_YEAR_CHARGE && 
        l.appliedFinancialYear === currentYear
    );

    if (!hasAssessment) {
      await StorageService.applyFullYearAssessment(currentYear);
    }
  },

  applyFullYearAssessment: async (year: number) => {
    // New Batch Implementation
    const configs = StorageService.getData<DueConfig>('dues_config');
    const annualTotal = configs.filter(c => c.billingFrequency === BillingFrequency.ANNUAL).reduce((sum, c) => sum + c.amount, 0);
    const monthlyTotal = configs.filter(c => c.billingFrequency === BillingFrequency.MONTHLY).reduce((sum, c) => sum + (c.amount * 12), 0);
    const totalAssessment = annualTotal + monthlyTotal;
    const batchId = `year-assessment-${year}-${Date.now()}`;

    try {
        const response = await fetch(`${API_URL}/batch/assessments`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('u48_token')}`
            },
            body: JSON.stringify({
                year,
                amount: totalAssessment,
                description: `ANNUAL ASSESSMENT ${year} (Total Dues: ₦${totalAssessment.toLocaleString()})`,
                referenceId: batchId
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Batch assessment failed');
        }

        await StorageService.sync();
        StorageService.logAudit('SYSTEM', `POST_ANNUAL_ASSESSMENT_${year}`, 'SYSTEM', batchId);
    } catch (e) {
        console.error("applyFullYearAssessment failed:", e);
        throw e;
    }
  },

  logAudit: async (userId: string, action: string, entityType: string, entityId: string) => {
    try {
        const user = StorageService.getMembers().find(m => m.id === userId);
        const entry: AuditLog = {
            id: `audit-${Date.now()}`,
            userId,
            userName: user?.fullName || 'System',
            action,
            entityType,
            entityId,
            timestamp: new Date().toISOString(),
            ipAddress: '127.0.0.1'
        };
        await fetch(`${API_URL}/audit_log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
        // No need to sync for audit log strictly, but good for admin view
    } catch (e) {
        console.error("logAudit failed:", e);
    }
  },

  resetSystem: async () => {
    await fetch(`${API_URL}/reset`, { method: 'POST' });
    window.location.reload();
  },

  saveData: async (key: string, data: any) => {
    if (key === 'u48_dues') {
      // Dues config bulk update
      // Backend doesn't have bulk update endpoint in generic CRUD, so we loop or add one.
      // Simplest: delete all and re-add.
      // But we can't delete all via generic API easily.
      // For now, let's assume we update them one by one.
      // Or add a bulk endpoint.
      // Let's iterate.
      const configs = data as DueConfig[];
      for (const d of configs) {
          await fetch(`${API_URL}/dues_config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(d)
          });
      }
      await StorageService.sync();
    }
  },

  getLedgerWithBalances: (memberId?: string): LedgerEntry[] => {
    const allEntries = StorageService.getData<LedgerEntry>('ledger_entry');
    const entries = memberId ? allEntries.filter(e => e.memberId === memberId) : allEntries;

    // Filter by status POSTED
    const postedEntries = entries.filter(e => e.status === LedgerStatus.POSTED);

    // Group by Member + Year + Category for running balance calculation
    // Sort Ascending for calculation: effective_date then created_at
    // Filter out entries that don't affect the member's balance (e.g. Expenses paid by bank)
    const sortedForCalc = [...postedEntries]
        .filter(entry => {
            const isDebit = entry.debitAccountId && entry.debitAccountId.includes('member');
            const isCredit = entry.creditAccountId && entry.creditAccountId.includes('member');
            // Also filter out actual zero-amount entries if any exist
            return (isDebit || isCredit) && entry.amount > 0;
        })
        .sort((a, b) => {
            const dateA = new Date(a.effectiveDate).getTime();
            const dateB = new Date(b.effectiveDate).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

    const buckets: Record<string, number> = {};
    
    const calculatedEntries = sortedForCalc.map(entry => {
        const year = entry.appliedFinancialYear;
        const category = entry.category || 'GENERAL';
        const bucketKey = `${entry.memberId}-${year}-${category}`;
        
        const currentBalance = buckets[bucketKey] || 0;
        
        // Debit (Due) increases balance (Debt), Credit (Payment) decreases it
        // Debit Account = Member means they owe money (Increase Balance)
        // Credit Account = Member means they paid money (Decrease Balance)
        let change = 0;
        if (entry.debitAccountId && entry.debitAccountId.includes('member')) {
            change = entry.amount;
        } else if (entry.creditAccountId && entry.creditAccountId.includes('member')) {
            change = -entry.amount;
        }

        const newBalance = currentBalance + change;
        buckets[bucketKey] = newBalance;

        return {
            ...entry,
            balance: newBalance,
            displayYear: year
        };
    });

    // Return sorted by date descending for display
    return calculatedEntries.sort((a, b) => {
        const dateA = new Date(a.effectiveDate).getTime();
        const dateB = new Date(b.effectiveDate).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
};
