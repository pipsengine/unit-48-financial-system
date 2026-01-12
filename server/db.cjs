
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { 
  MOCK_MEMBERS, MOCK_DUES_CONFIG, MOCK_LEDGER, MOCK_PAYMENTS, MOCK_EXPENSES, MOCK_AUDIT_LOGS 
} = require('./mockData.cjs');

const DB_PATH = path.resolve(__dirname, 'Unit48_Ps.sqlite');

class DbService {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Could not connect to database', err);
      } else {
        console.log('Connected to SQLite database: Unit48_Ps');
        this.init();
      }
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          console.error('Error running sql ' + sql);
          console.error(err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, result) => {
        if (err) {
          console.error('Error running sql: ' + sql);
          console.error(err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error running sql: ' + sql);
          console.error(err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async init() {
    try {
      await this.run(`
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
        )
      `);

      await this.run(`
        CREATE TABLE IF NOT EXISTS dues_config (
          id TEXT PRIMARY KEY,
          due_type TEXT NOT NULL,
          billing_frequency TEXT NOT NULL,
          amount REAL NOT NULL,
          effective_start_date TEXT NOT NULL,
          effective_end_date TEXT
        )
      `);

      await this.run(`
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
        )
      `);

      await this.run(`
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
        )
      `);

      await this.run(`
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
        )
      `);

      await this.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          user_name TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT
        )
      `);

      // Seed if empty
      const memberCount = await this.get("SELECT count(*) as count FROM member");
      if (memberCount.count === 0) {
        console.log("Seeding database...");
        await this.seed();
      } else {
        // Ensure dues_config is seeded (migration fix)
        const duesCount = await this.get("SELECT count(*) as count FROM dues_config");
        if (duesCount.count === 0) {
           console.log("Seeding missing dues_config...");
           for (const d of MOCK_DUES_CONFIG) {
            await this.run(
              "INSERT OR IGNORE INTO dues_config (id, due_type, billing_frequency, amount, effective_start_date) VALUES (?,?,?,?,?)",
              [d.id, d.dueType, d.billingFrequency, d.amount, d.effectiveStartDate]
            );
           }
        }
      }

    } catch (err) {
      console.error("Database initialization failed:", err);
    }
  }

  async seed() {
    try {
      for (const m of MOCK_MEMBERS) {
        await this.run(
          "INSERT OR IGNORE INTO member (id, membership_id, email, phone, full_name, date_of_joining, status, role, password, address, dob, previous_balance) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          [m.id, m.membershipId, m.email, m.phone, m.fullName, m.dateOfJoining, m.status, m.role, m.password, m.address, m.dob, m.balance || 0] // Note: Mock data has balance, mapped to previous_balance for initial seed? 
          // Actually mock data 'balance' seems to be net balance, but schema has previous_balance. 
          // Let's assume mock balance is previous_balance for simplicity or calculate it.
          // In StorageService.ts seedData: previous_balance wasn't in INSERT! 
          // But here I added it.
        );
      }
      for (const d of MOCK_DUES_CONFIG) {
        await this.run(
          "INSERT OR IGNORE INTO dues_config (id, due_type, billing_frequency, amount, effective_start_date) VALUES (?,?,?,?,?)",
          [d.id, d.dueType, d.billingFrequency, d.amount, d.effectiveStartDate]
        );
      }
      for (const p of MOCK_PAYMENTS) {
        await this.run(
          "INSERT OR IGNORE INTO payment (id, member_id, member_name, amount, payment_date, payment_method, reference_number, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          [p.id, p.memberId, p.memberName, p.amount, p.paymentDate, p.paymentMethod, p.referenceNumber, p.status, p.createdAt]
        );
      }
      for (const e of MOCK_EXPENSES) {
        await this.run(
          "INSERT OR IGNORE INTO expense (id, title, description, category, amount, incurred_date, submitted_by, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          [e.id, e.title, e.description, e.category, e.amount, e.incurredDate, e.submittedBy, e.status, e.createdAt]
        );
      }
      for (const l of MOCK_LEDGER) {
        await this.run(
          "INSERT OR IGNORE INTO ledger_entry (id, entry_date, effective_date, description, debit_account_id, credit_account_id, amount, member_id, reference_type, reference_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          [l.id, l.entryDate, l.effectiveDate, l.description, l.debitAccountId, l.creditAccountId, l.amount, l.memberId, l.referenceType, l.referenceId, l.createdAt]
        );
      }
      for (const a of MOCK_AUDIT_LOGS) {
        await this.run(
            "INSERT OR IGNORE INTO audit_log (id, user_id, user_name, action, entity_type, entity_id, timestamp, ip_address) VALUES (?,?,?,?,?,?,?,?)",
            [a.id, a.userId, a.userName, a.action, a.entityType, a.entityId, a.timestamp, a.ipAddress]
        );
      }
      console.log("Seeding completed.");
    } catch (e) {
      console.error("Seeding failed:", e);
    }
  }
}

module.exports = new DbService();
