
import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { 
  Member, LedgerEntry, Payment, Expense, DueConfig, AuditLog, 
  MemberStatus, UserRole, PaymentStatus, ExpenseStatus, DueType, BillingFrequency 
} from '../types';
import { MOCK_MEMBERS, MOCK_DUES_CONFIG, MOCK_PAYMENTS, MOCK_EXPENSES, MOCK_LEDGER } from './mockData';

let db: any = null;
const DB_STORAGE_KEY = 'u48_sqlite_db';

export const StorageService = {
  isReady: false,

  init: async () => {
    if (StorageService.isReady) return;

    try {
      // Use local WASM file bundled by Vite
      const wasmUrl = sqlWasmUrl;
      const wasmResponse = await fetch(wasmUrl);
      if (!wasmResponse.ok) throw new Error(`Failed to fetch SQL WASM binary from ${wasmUrl}`);
      const wasmBinary = await wasmResponse.arrayBuffer();

      // initSqlJs is the default export when using esm.sh
      const SQL = await initSqlJs({
        wasmBinary: wasmBinary
      });

      const savedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (savedDb) {
        try {
          const u8 = new Uint8Array(atob(savedDb).split('').map(c => c.charCodeAt(0)));
          db = new SQL.Database(u8);
        } catch (e) {
          console.warn("Corrupt database found in storage, resetting...", e);
          db = new SQL.Database();
          StorageService.createSchema();
          StorageService.seedData();
          StorageService.save();
        }
      } else {
        db = new SQL.Database();
        StorageService.createSchema();
        StorageService.seedData();
        StorageService.save();
      }

      StorageService.isReady = true;
      
      // Migration: Add previous_balance column if not exists
      try {
        db.run("ALTER TABLE member ADD COLUMN previous_balance REAL DEFAULT 0");
        StorageService.save();
      } catch (e) {
        // Column likely already exists, ignore
      }

      StorageService.checkAndApplyAnnualDues();
    } catch (err) {
      console.error("StorageService.init failed critically:", err);
      throw err;
    }
  },

  save: () => {
    if (!db) return;
    try {
      const data = db.export();
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(data)));
      localStorage.setItem(DB_STORAGE_KEY, base64);
    } catch (err) {
      console.error("Failed to persist database to localStorage:", err);
    }
  },

  createSchema: () => {
    if (!db) return;
    db.run(`
      CREATE TABLE IF NOT EXISTS member (
        id TEXT PRIMARY KEY,
        membership_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        full_name TEXT NOT NULL,
        date_of_joining TEXT NOT NULL,
        status TEXT NOT NULL,
        role TEXT NOT NULL,
        password TEXT,
        address TEXT,
        dob TEXT,
        previous_balance REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dues_config (
        id TEXT PRIMARY KEY,
        due_type TEXT NOT NULL,
        billing_frequency TEXT NOT NULL,
        amount REAL NOT NULL,
        effective_start_date TEXT NOT NULL,
        effective_end_date TEXT
      );

      CREATE TABLE IF NOT EXISTS ledger_entry (
        id TEXT PRIMARY KEY,
        entry_date TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        description TEXT NOT NULL,
        debit_account_id TEXT NOT NULL,
        credit_account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        member_id TEXT,
        reference_type TEXT,
        reference_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        payment_type TEXT,
        reference_number TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expense (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        incurred_date TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_name TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT
      );
    `);
  },

  seedData: () => {
    if (!db) return;
    
    db.run("BEGIN TRANSACTION;");
    try {
      MOCK_MEMBERS.forEach(m => {
        db.run("INSERT OR IGNORE INTO member (id, membership_id, email, phone, full_name, date_of_joining, status, role, password, address, dob) VALUES (?,?,?,?,?,?,?,?,?,?,?)", 
          [m.id, m.membershipId, m.email, m.phone, m.fullName, m.dateOfJoining, m.status, m.role, m.password, m.address, m.dob]);
      });
      MOCK_DUES_CONFIG.forEach(d => {
        db.run("INSERT OR IGNORE INTO dues_config (id, due_type, billing_frequency, amount, effective_start_date) VALUES (?,?,?,?,?)", 
          [d.id, d.dueType, d.billingFrequency, d.amount, d.effectiveStartDate]);
      });
      MOCK_PAYMENTS.forEach(p => {
        db.run("INSERT OR IGNORE INTO payment (id, member_id, member_name, amount, payment_date, payment_method, reference_number, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)", 
          [p.id, p.memberId, p.memberName, p.amount, p.paymentDate, p.paymentMethod, p.referenceNumber, p.status, p.createdAt]);
      });
      MOCK_EXPENSES.forEach(e => {
        db.run("INSERT OR IGNORE INTO expense (id, title, description, category, amount, incurred_date, submitted_by, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)", 
          [e.id, e.title, e.description, e.category, e.amount, e.incurredDate, e.submittedBy, e.status, e.createdAt]);
      });
      MOCK_LEDGER.forEach(l => {
        db.run("INSERT OR IGNORE INTO ledger_entry (id, entry_date, effective_date, description, debit_account_id, credit_account_id, amount, member_id, reference_type, reference_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", 
          [l.id, l.entryDate, l.effectiveDate, l.description, l.debitAccountId, l.creditAccountId, l.amount, l.memberId, l.referenceType, l.referenceId, l.createdAt]);
      });
      db.run("COMMIT;");
    } catch (e) {
      db.run("ROLLBACK;");
      console.error("Seeding failed:", e);
    }
  },

  getData: <T>(tableName: string): T[] => {
    if (!db) return [];
    
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
    const actualTable = tableMap[tableName] || tableName;
    
    try {
      const res = db.exec(`SELECT * FROM ${actualTable}`);
      if (res.length === 0) return [];
      
      const columns = res[0].columns;
      return res[0].values.map((row: any[]) => {
        const obj: any = {};
        columns.forEach((col: string, i: number) => {
          const camelKey = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          obj[camelKey] = row[i];
        });
        return obj as T;
      });
    } catch (e) {
      console.error(`Error querying table ${actualTable}:`, e);
      return [];
    }
  },

  getMembers: (): Member[] => {
    if (!db) return [];
    const members = StorageService.getData<Member>('member');
    return members.map(m => {
      const res = db.exec(`
        SELECT 
          COALESCE(SUM(CASE WHEN reference_type = 'PAYMENT' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN reference_type != 'PAYMENT' THEN amount ELSE 0 END), 0) as balance
        FROM ledger_entry 
        WHERE member_id = ?
      `, [m.id]);
      const ledgerBalance = res[0].values[0][0];
      const previousBalance = m.previousBalance || 0;
      return { ...m, balance: Number(ledgerBalance) + previousBalance };
    });
  },

  getPayments: (): Payment[] => {
    return StorageService.getData<Payment>('payment');
  },

  getExpenses: (): Expense[] => {
    return StorageService.getData<Expense>('expense');
  },

  updateMember: (member: Member) => {
    if (!db) return;
    db.run(`
      INSERT OR REPLACE INTO member (id, membership_id, email, phone, full_name, date_of_joining, status, role, password, address, dob, previous_balance)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, [member.id, member.membershipId, member.email, member.phone, member.fullName, member.dateOfJoining, member.status, member.role, member.password, member.address, member.dob, member.previousBalance || 0]);
    StorageService.save();
    StorageService.logAudit(member.id, 'UPDATE_MEMBER', 'MEMBER', member.id);
  },

  deleteMember: (memberId: string) => {
    if (!db) {
      console.error("Database not initialized");
      return;
    }
    if (!memberId || typeof memberId !== 'string') {
      console.error("Invalid memberId for deletion:", memberId);
      return;
    }

    try {
      console.log(`Attempting to delete member with ID: ${memberId}`);
      // Check if member exists first
    const check = db.exec("SELECT id, role FROM member WHERE id = ?", [memberId]);
    if (check.length === 0 || check[0].values.length === 0) {
      console.warn(`Member ${memberId} not found, skipping delete.`);
      return;
    }

    const memberRole = check[0].values[0][1];
    if (memberRole === UserRole.SUPER_ADMIN) {
      console.warn("Cannot delete SUPER_ADMIN account.");
      return;
    }

    db.run("DELETE FROM member WHERE id = ?", [memberId]);
      StorageService.save();
      StorageService.logAudit('SYSTEM', 'DELETE_MEMBER', 'MEMBER', memberId);
      console.log(`Member ${memberId} successfully deleted.`);
    } catch (e) {
      console.error("Error executing deleteMember:", e);
    }
  },

  addPayment: (payment: Payment, adminId: string) => {
    if (!db) return;
    db.run(`
      INSERT INTO payment (id, member_id, member_name, amount, payment_date, payment_method, payment_type, reference_number, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [payment.id, payment.memberId, payment.memberName, payment.amount, payment.paymentDate, payment.paymentMethod, payment.paymentType, payment.referenceNumber, payment.status, payment.createdAt]);
    
    if (payment.status === PaymentStatus.VERIFIED) {
      StorageService.postPaymentToLedger(payment);
    }
    StorageService.save();
    StorageService.logAudit(adminId, 'RECORD_PAYMENT', 'PAYMENT', payment.id);
  },

  verifyPayment: (paymentId: string, adminId: string) => {
    if (!db) return;
    db.run("UPDATE payment SET status = ? WHERE id = ?", [PaymentStatus.VERIFIED, paymentId]);
    const res = db.exec("SELECT * FROM payment WHERE id = ?", [paymentId]);
    if (res.length > 0) {
      const columns = res[0].columns;
      const row = res[0].values[0];
      const p: any = {};
      columns.forEach((col: string, i: number) => { p[col.replace(/_([a-z])/g, g => g[1].toUpperCase())] = row[i]; });
      StorageService.postPaymentToLedger(p as Payment);
    }
    StorageService.save();
    StorageService.logAudit(adminId, 'VERIFY_PAYMENT', 'PAYMENT', paymentId);
  },

  postPaymentToLedger: (payment: Payment) => {
    if (!db) return;
    const id = `l-pay-${Date.now()}`;
    db.run(`
      INSERT INTO ledger_entry (id, entry_date, effective_date, description, debit_account_id, credit_account_id, amount, member_id, reference_type, reference_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [
      id, payment.paymentDate, payment.paymentDate, 
      `Payment (${payment.paymentType || 'General'}): ${payment.referenceNumber}${payment.notes ? ` - ${payment.notes}` : ''}`,
      'acc-bank', 'acc-member-receivable', payment.amount, payment.memberId, 'PAYMENT', payment.id
    ]);
  },

  addExpense: (expense: Expense, userId: string) => {
    if (!db) return;
    db.run(`
      INSERT INTO expense (id, title, description, category, amount, incurred_date, submitted_by, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [expense.id, expense.title, expense.description, expense.category, expense.amount, expense.incurredDate, expense.submittedBy, expense.status, expense.createdAt]);
    StorageService.save();
    StorageService.logAudit(userId, 'SUBMIT_EXPENSE', 'EXPENSE', expense.id);
  },

  updateExpenseStatus: (expenseId: string, status: ExpenseStatus, adminId: string) => {
    if (!db) return;
    db.run("UPDATE expense SET status = ? WHERE id = ?", [status, expenseId]);
    StorageService.save();
    StorageService.logAudit(adminId, `EXPENSE_${status}`, 'EXPENSE', expenseId);
  },

  checkAndApplyAnnualDues: () => {
    if (!db) return;
    const currentYear = new Date().getFullYear();
    const res = db.exec("SELECT COUNT(*) FROM ledger_entry WHERE reference_type = 'AUTO_DEBIT_BATCH' AND description LIKE ?", [`%ANNUAL ASSESSMENT ${currentYear}%`]);
    if (res[0].values[0][0] === 0) {
      StorageService.applyFullYearAssessment(currentYear);
    }
  },

  applyFullYearAssessment: (year: number) => {
    if (!db) return;
    const activeMembers = StorageService.getMembers().filter(m => m.status === MemberStatus.ACTIVE);
    const configs = StorageService.getData<DueConfig>('dues_config');
    const batchId = `year-assessment-${year}-${Date.now()}`;
    
    const annualTotal = configs.filter(c => c.billingFrequency === BillingFrequency.ANNUAL).reduce((sum, c) => sum + c.amount, 0);
    const monthlyTotal = configs.filter(c => c.billingFrequency === BillingFrequency.MONTHLY).reduce((sum, c) => sum + (c.amount * 12), 0);
    const totalAssessment = annualTotal + monthlyTotal;

    activeMembers.forEach(member => {
      const id = `l-year-${year}-${member.id}`;
      db.run(`
        INSERT INTO ledger_entry (id, entry_date, effective_date, description, debit_account_id, credit_account_id, amount, member_id, reference_type, reference_id)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `, [
        id, `${year}-01-01`, `${year}-01-01`, 
        `ANNUAL ASSESSMENT ${year} (Total Dues: ₦${totalAssessment.toLocaleString()})`,
        'acc-member-receivable', 'acc-revenue-annual', totalAssessment, member.id, 'AUTO_DEBIT_BATCH', batchId
      ]);
    });

    StorageService.save();
    StorageService.logAudit('SYSTEM', `POST_ANNUAL_ASSESSMENT_${year}`, 'SYSTEM', batchId);
  },

  logAudit: (userId: string, action: string, entityType: string, entityId: string) => {
    if (!db) return;
    const user = StorageService.getMembers().find(m => m.id === userId);
    db.run("INSERT INTO audit_log (id, user_id, user_name, action, entity_type, entity_id, ip_address) VALUES (?,?,?,?,?,?,?)",
      [`audit-${Date.now()}`, userId, user?.fullName || 'System', action, entityType, entityId, '127.0.0.1']);
    StorageService.save();
  },

  resetSystem: () => {
    localStorage.removeItem(DB_STORAGE_KEY);
    window.location.reload();
  },

  saveData: (key: string, data: any) => {
    if (!db) return;
    if (key === 'u48_dues') {
      db.run("DELETE FROM dues_config");
      data.forEach((d: DueConfig) => {
        db.run("INSERT INTO dues_config (id, due_type, billing_frequency, amount, effective_start_date) VALUES (?,?,?,?,?)", 
          [d.id, d.dueType, d.billingFrequency, d.amount, d.effectiveStartDate]);
      });
      StorageService.save();
    }
  }
};
