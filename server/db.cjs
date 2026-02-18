
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
        // console.log('Connected to SQLite database: Unit48_Ps');
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

  async ensureColumn(tableName, columnName, columnDef) {
    try {
      const cols = await this.all(`PRAGMA table_info(${tableName})`);
      const exists = cols.some(c => c.name === columnName);
      if (!exists) {
        await this.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
        console.log(`Added column ${columnName} to ${tableName}`);
      }
    } catch (err) {
      console.error(`Failed to ensure column ${columnName} in ${tableName}:`, err);
    }
  }

  async init() {
    try {
      await this.ensureColumn('ledger_entry', 'category', 'TEXT');
      await this.ensureColumn('ledger_entry', 'applied_financial_year', 'INTEGER');
      await this.ensureColumn('ledger_entry', 'posting_type', 'TEXT');

      // MIGRATION: Backfill missing data for existing live records
      console.log('Running migrations to backfill data...');
      
      // 1. Backfill Applied Financial Year from Effective Date
      await this.run(`
        UPDATE ledger_entry 
        SET applied_financial_year = strftime('%Y', effective_date) 
        WHERE applied_financial_year IS NULL
      `);

      // 2. Backfill Category based on Account IDs or Description
       // Note: We use OR IGNORE or specific conditions to ensure we don't overwrite if not needed, 
       // but here we want to FIX existing wrong categories (like generic 'DUES')
       
       await this.run(`
         UPDATE ledger_entry 
         SET category = 'NATIONAL_DUE' 
         WHERE (category IS NULL OR category = 'DUES') 
         AND (
           credit_account_id = 'acc-revenue-national' 
           OR description LIKE '%National Due%'
           OR description LIKE '%National%'
         )
       `);
       
       await this.run(`
         UPDATE ledger_entry 
         SET category = 'UNIT_DUE' 
         WHERE (category IS NULL OR category = 'DUES') 
         AND (
           credit_account_id = 'acc-revenue-unit' 
           OR description LIKE '%Unit Due%'
           OR description LIKE '%Unit%'
         )
       `);
 
       await this.run(`
         UPDATE ledger_entry 
         SET category = 'WELFARE_DUE' 
         WHERE (category IS NULL OR category = 'DUES') 
         AND (
           credit_account_id = 'acc-revenue-welfare' 
           OR description LIKE '%Welfare Due%'
           OR description LIKE '%Welfare%'
         )
       `);
 
       await this.run(`
         UPDATE ledger_entry 
         SET category = 'DEVELOPMENT_LEVY' 
         WHERE (category IS NULL OR category = 'DUES') 
         AND (
           credit_account_id = 'acc-revenue-development' 
           OR description LIKE '%Development Levy%'
           OR description LIKE '%Development%'
         )
       `);
      
      console.log('Migrations completed.');

      await this.run(`
        CREATE TABLE IF NOT EXISTS member (
          id TEXT PRIMARY KEY,
          membership_id TEXT UNIQUE NOT NULL,
          member_code TEXT UNIQUE,
          email TEXT UNIQUE NOT NULL,
          phone TEXT NOT NULL,
          full_name TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          middle_name TEXT,
          date_of_joining TEXT NOT NULL,
          date_joined TEXT,
          status TEXT NOT NULL,
          membership_status TEXT,
          role TEXT NOT NULL,
          password TEXT,
          address TEXT,
          state TEXT,
          lga TEXT,
          dob TEXT,
          previous_balance REAL DEFAULT 0,
          next_of_kin_name TEXT,
          next_of_kin_phone TEXT,
          profile_photo_url TEXT,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.run(`
        CREATE TABLE IF NOT EXISTS password_resets (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES member(id)
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
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          applied_financial_year INTEGER,
          posting_type TEXT,
          category TEXT
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
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          applied_financial_year INTEGER
        )
      `);

      await this.ensureColumn("ledger_entry", "applied_financial_year", "INTEGER");
      await this.ensureColumn("ledger_entry", "posting_year", "INTEGER");
      await this.ensureColumn("ledger_entry", "posting_type", "TEXT");
      await this.ensureColumn("ledger_entry", "category", "TEXT");
      await this.ensureColumn("ledger_entry", "status", "TEXT");

      await this.ensureColumn("payment", "applied_financial_year", "INTEGER");
      await this.ensureColumn("payment", "reversal_reference_id", "TEXT");
      await this.ensureColumn("payment", "correction_reason", "TEXT");
      await this.ensureColumn("payment", "corrected_by", "TEXT");
      await this.ensureColumn("payment", "corrected_at", "TEXT");
      await this.ensureColumn("expense", "beneficiary", "TEXT");

      await this.ensureColumn("member", "member_code", "TEXT");
      await this.ensureColumn("member", "first_name", "TEXT");
      await this.ensureColumn("member", "last_name", "TEXT");
      await this.ensureColumn("member", "middle_name", "TEXT");
      await this.ensureColumn("member", "state", "TEXT");
      await this.ensureColumn("member", "lga", "TEXT");
      await this.ensureColumn("member", "rank_or_position", "TEXT");
      await this.ensureColumn("member", "date_joined", "TEXT");
      await this.ensureColumn("member", "membership_status", "TEXT");
      await this.ensureColumn("member", "next_of_kin_name", "TEXT");
      await this.ensureColumn("member", "next_of_kin_phone", "TEXT");
      await this.ensureColumn("member", "profile_photo_url", "TEXT");
      await this.ensureColumn("member", "notes", "TEXT");

      await this.ensureColumn("audit_log", "action_type", "TEXT");
      await this.ensureColumn("audit_log", "changed_fields", "TEXT");
      await this.ensureColumn("audit_log", "reason", "TEXT");

      await this.run("UPDATE member SET member_code = membership_id WHERE (member_code IS NULL OR member_code = '') AND membership_id IS NOT NULL");
      await this.run("UPDATE member SET membership_status = status WHERE (membership_status IS NULL OR membership_status = '') AND status IS NOT NULL");
      await this.run("UPDATE member SET date_joined = date_of_joining WHERE (date_joined IS NULL OR date_joined = '') AND date_of_joining IS NOT NULL");

      await this.run(`
        CREATE TABLE IF NOT EXISTS expense (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          amount REAL NOT NULL,
          incurred_date TEXT NOT NULL,
          submitted_by TEXT NOT NULL,
          beneficiary TEXT,
          status TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.run(`
        CREATE TABLE IF NOT EXISTS session (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
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
          ip_address TEXT,
          action_type TEXT,
          changed_fields TEXT,
          reason TEXT
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
          "INSERT OR IGNORE INTO ledger_entry (id, entry_date, effective_date, description, debit_account_id, credit_account_id, amount, member_id, reference_type, reference_id, created_at, applied_financial_year, posting_type, category) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [l.id, l.entryDate, l.effectiveDate, l.description, l.debitAccountId, l.creditAccountId, l.amount, l.memberId, l.referenceType, l.referenceId, l.createdAt, l.appliedFinancialYear, l.postingType, l.category]
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
