
import { 
  Member, LedgerEntry, Payment, Expense, DueConfig, AuditLog, 
  MemberStatus, UserRole, PaymentStatus, ExpenseStatus, DueType, BillingFrequency 
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

    try {
      await StorageService.sync();
      StorageService.isReady = true;
      
      // Setup polling for live data (every 5 seconds)
      setInterval(() => {
        StorageService.sync().catch(console.error);
      }, 5000);

    } catch (err) {
      console.error("StorageService.init failed:", err);
      // Fallback or retry logic could go here
    }
  },

  sync: async () => {
    try {
      const res = await fetch(`${API_URL}/sync`).catch(() => null);
      if (!res) {
        console.warn("Backend not reachable");
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

    return members.map(m => {
      // Reimplement SQL logic in JS
      // SELECT COALESCE(SUM(CASE WHEN reference_type = 'PAYMENT' THEN amount ELSE 0 END), 0) - ...
      const memberEntries = ledger.filter(l => l.memberId === m.id);
      
      const paymentsSum = memberEntries
        .filter(l => l.referenceType === 'PAYMENT')
        .reduce((sum, l) => sum + l.amount, 0);
        
      const debitsSum = memberEntries
        .filter(l => l.referenceType !== 'PAYMENT')
        .reduce((sum, l) => sum + l.amount, 0);
      
      const ledgerBalance = paymentsSum - debitsSum;
      const previousBalance = m.previousBalance || 0;
      
      return { ...m, balance: ledgerBalance + previousBalance };
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
      const { balance, ...memberData } = member;

      await fetch(`${API_URL}/member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });
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

  postPaymentToLedger: async (payment: Payment) => {
    const id = `l-pay-${Date.now()}`;
    const entry: LedgerEntry = {
        id,
        entryDate: payment.paymentDate,
        effectiveDate: payment.paymentDate,
        description: `Payment (${payment.paymentType || 'General'}): ${payment.referenceNumber}${payment.notes ? ` - ${payment.notes}` : ''}`,
        debitAccountId: 'acc-bank',
        creditAccountId: 'acc-member-receivable',
        amount: payment.amount,
        memberId: payment.memberId,
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        createdAt: new Date().toISOString() // Assuming ISO string for simplicity
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
        l.referenceType === 'AUTO_DEBIT_BATCH' && 
        l.description.includes(`ANNUAL ASSESSMENT ${currentYear}`)
    );

    if (!hasAssessment) {
      await StorageService.applyFullYearAssessment(currentYear);
    }
  },

  applyFullYearAssessment: async (year: number) => {
    const activeMembers = StorageService.getMembers().filter(m => m.status === MemberStatus.ACTIVE);
    const configs = StorageService.getData<DueConfig>('dues_config');
    const batchId = `year-assessment-${year}-${Date.now()}`;
    
    const annualTotal = configs.filter(c => c.billingFrequency === BillingFrequency.ANNUAL).reduce((sum, c) => sum + c.amount, 0);
    const monthlyTotal = configs.filter(c => c.billingFrequency === BillingFrequency.MONTHLY).reduce((sum, c) => sum + (c.amount * 12), 0);
    const totalAssessment = annualTotal + monthlyTotal;

    // We can batch insert via Promise.all
    const promises = activeMembers.map(member => {
      const id = `l-year-${year}-${member.id}`;
      const entry: LedgerEntry = {
          id,
          entryDate: `${year}-01-01`,
          effectiveDate: `${year}-01-01`,
          description: `ANNUAL ASSESSMENT ${year} (Total Dues: ₦${totalAssessment.toLocaleString()})`,
          debitAccountId: 'acc-member-receivable',
          creditAccountId: 'acc-revenue-annual',
          amount: totalAssessment,
          memberId: member.id,
          referenceType: 'AUTO_DEBIT_BATCH',
          referenceId: batchId,
          createdAt: new Date().toISOString()
      };
      return fetch(`${API_URL}/ledger_entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
      });
    });

    await Promise.all(promises);
    await StorageService.sync();
    StorageService.logAudit('SYSTEM', `POST_ANNUAL_ASSESSMENT_${year}`, 'SYSTEM', batchId);
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
  }
};
