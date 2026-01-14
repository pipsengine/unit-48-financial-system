
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db.cjs');

const crypto = require('crypto');

const app = express();
// Hard Delete Payment (and associated ledger entries)
app.delete('/api/payment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete associated ledger entries first
    await db.run('DELETE FROM ledger_entry WHERE reference_id = ?', [id]);
    
    // Delete the payment
    const result = await db.run('DELETE FROM payment WHERE id = ?', [id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json({ message: 'Payment and associated ledger entries deleted permanently' });
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(bodyParser.json());

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { membershipId, password } = req.body;
    const member = await db.get('SELECT * FROM member WHERE membership_id = ?', [membershipId]);
    
    if (!member) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Password check (replicating App.tsx logic)
    // Note: In production, use bcrypt. Here we match existing plain text logic.
    const isValid = member.password === password || (!member.password && password === 'Admin123');
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    // Default 5 minutes expiry, updated on activity
    const expiresAt = Date.now() + (5 * 60 * 1000); 

    await db.run('INSERT INTO session (token, user_id, expires_at) VALUES (?, ?, ?)', [token, member.id, expiresAt]);

    // Convert snake_case to camelCase
    const toCamel = (o) => {
      const newO = {};
      for (const key in o) {
        const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newO[newKey] = o[key];
      }
      return newO;
    };

    res.json({ token, user: toCamel(member), expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await db.run('DELETE FROM session WHERE token = ?', [token]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/heartbeat', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    const session = await db.get('SELECT * FROM session WHERE token = ?', [token]);
    if (!session) {
      return res.status(401).json({ error: 'Session invalid' });
    }

    if (session.expires_at < Date.now()) {
      await db.run('DELETE FROM session WHERE token = ?', [token]);
      return res.status(401).json({ error: 'Session expired' });
    }
    
    // Extend session by 5 minutes
    const newExpiresAt = Date.now() + (5 * 60 * 1000);
    await db.run('UPDATE session SET expires_at = ? WHERE token = ?', [newExpiresAt, token]);
    
    res.json({ success: true, expiresAt: newExpiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    const member = await db.get(
      'SELECT * FROM member WHERE phone = ? OR membership_id = ?', 
      [identifier, identifier]
    );

    if (!member) {
      return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + (15 * 60 * 1000);

    await db.run(
      'INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)',
      [code, member.id, expiresAt]
    );

    console.log('---------------------------------------------------');
    console.log(`[SMS SIMULATION] Password Reset Code for ${member.full_name} (${member.phone})`);
    console.log(`[SMS SIMULATION] Code: ${code}`);
    console.log('---------------------------------------------------');

    res.json({ success: true, message: 'Reset code sent to registered phone.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const resetRecord = await db.get('SELECT * FROM password_resets WHERE token = ?', [token]);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    if (resetRecord.used) {
      return res.status(400).json({ error: 'Token already used.' });
    }

    if (resetRecord.expires_at < Date.now()) {
      return res.status(400).json({ error: 'Token expired.' });
    }

    // Update password
    await db.run('UPDATE member SET password = ? WHERE id = ?', [newPassword, resetRecord.user_id]);
    
    // Invalidate all sessions for this user to force re-login
    await db.run('DELETE FROM session WHERE user_id = ?', [resetRecord.user_id]);
    
    // Mark token as used
    await db.run('UPDATE password_resets SET used = 1 WHERE token = ?', [token]);

    // Auto-login: Generate new session
    const newToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (5 * 60 * 1000);
    await db.run('INSERT INTO session (token, user_id, expires_at) VALUES (?, ?, ?)', [newToken, resetRecord.user_id, expiresAt]);
    
    // Get member details for frontend
    const member = await db.get('SELECT * FROM member WHERE id = ?', [resetRecord.user_id]);
    
    // Convert snake_case to camelCase
    const toCamel = (o) => {
      const newO = {};
      for (const key in o) {
        const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newO[newKey] = o[key];
      }
      return newO;
    };

    res.json({ success: true, token: newToken, user: toCamel(member) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const session = await db.get('SELECT * FROM session WHERE token = ?', [token]);
    if (!session || session.expires_at < Date.now()) {
      return res.status(401).json({ error: 'Session expired' });
    }
    req.user = { id: session.user_id };
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Sync endpoint to get all data at once
app.get('/api/sync', authenticateToken, async (req, res) => {
  try {
    const members = await db.all('SELECT * FROM member');
    const payments = await db.all('SELECT * FROM payment');
    const ledger = await db.all('SELECT * FROM ledger_entry');
    const expenses = await db.all('SELECT * FROM expense');
    const dues = await db.all('SELECT * FROM dues_config');
    const audit = await db.all('SELECT * FROM audit_log');

    // Convert snake_case to camelCase for frontend compatibility
    const toCamel = (o) => {
      const newO = {};
      for (const key in o) {
        const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newO[newKey] = o[key];
      }
      return newO;
    };

    res.json({
      member: members.map(toCamel),
      payment: payments.map(toCamel),
      ledger_entry: ledger.map(toCamel),
      expense: expenses.map(toCamel),
      dues_config: dues.map(toCamel),
      audit_log: audit.map(toCamel)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/personal-ledger', authenticateToken, async (req, res) => {
  try {
    const memberId = req.query.memberId;
    const yearParam = req.query.year;
    const category = req.query.category;
    const type = req.query.type;
    const status = req.query.status || 'POSTED';

    if (!memberId) {
      return res.status(400).json({ error: 'memberId is required' });
    }

    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (Number.isNaN(year)) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    let sql = 'SELECT * FROM ledger_entry WHERE member_id = ? AND applied_financial_year = ?';
    const params = [memberId, year];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (type) {
      sql += ' AND posting_type = ?';
      params.push(type);
    }

    sql += ' AND status = ? ORDER BY effective_date ASC, created_at ASC';
    params.push(status);

    const rows = await db.all(sql, params);

    const toCamel = (o) => {
      const newO = {};
      for (const key in o) {
        const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newO[newKey] = o[key];
      }
      return newO;
    };

    const entries = rows.map(toCamel);

    const buckets = {};
    const withBalances = entries.map((entry) => {
      const appliedYear = entry.appliedFinancialYear;
      const cat = entry.category || 'GENERAL';
      const bucketKey = `${entry.memberId}-${appliedYear}-${cat}`;
      const currentBalance = buckets[bucketKey] || 0;

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
        displayYear: appliedYear
      };
    });

    res.json({
      memberId,
      year,
      entries: withBalances
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/batch/assessments', authenticateToken, async (req, res) => {
  try {
    const { year, amount, description, referenceId, allocations } = req.body;
    
    if (!year || (!amount && !allocations)) {
      return res.status(400).json({ error: 'Year and Amount (or Allocations) are required' });
    }

    // Get all active members
    const members = await db.all('SELECT * FROM member WHERE status = ?', ['ACTIVE']);
    
    if (members.length === 0) {
      return res.json({ message: 'No active members found', count: 0 });
    }

    const ledgerEntries = [];
    
    for (const member of members) {
        if (allocations && Array.isArray(allocations)) {
            // Create multiple split entries per member
            allocations.forEach((alloc, idx) => {
                ledgerEntries.push({
                    id: `l-year-${year}-${member.id}-${idx}`,
                    entry_date: `${year}-01-01`,
                    effective_date: `${year}-01-01`,
                    description: description || `ANNUAL ASSESSMENT ${year} - ${alloc.description || 'General'}`,
                    debit_account_id: 'acc-member-receivable',
                    credit_account_id: alloc.account,
                    amount: alloc.amount,
                    member_id: member.id,
                    reference_type: 'AUTO_DEBIT_BATCH',
                    reference_id: referenceId || `year-assessment-${year}-${Date.now()}`,
                    created_at: new Date().toISOString(),
                    applied_financial_year: year,
                    posting_year: new Date().getFullYear(),
                    posting_type: 'CURRENT_YEAR_CHARGE',
                    category: 'DUES',
                    status: 'POSTED'
                });
            });
        } else {
            // Legacy single entry behavior
            ledgerEntries.push({
                id: `l-year-${year}-${member.id}`,
                entry_date: `${year}-01-01`,
                effective_date: `${year}-01-01`,
                description: description || `ANNUAL ASSESSMENT ${year}`,
                debit_account_id: 'acc-member-receivable',
                credit_account_id: 'acc-revenue-annual',
                amount: amount,
                member_id: member.id,
                reference_type: 'AUTO_DEBIT_BATCH',
                reference_id: referenceId || `year-assessment-${year}-${Date.now()}`,
                created_at: new Date().toISOString(),
                applied_financial_year: year,
                posting_year: new Date().getFullYear(),
                posting_type: 'CURRENT_YEAR_CHARGE',
                category: 'DUES',
                status: 'POSTED'
            });
        }
    }

    // Batch Insert using transaction
    // SQLite doesn't support bulk insert with json simply, we loop in transaction
    // Or we can construct one big INSERT statement
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      const stmt = `INSERT OR REPLACE INTO ledger_entry (
        id, entry_date, effective_date, description, debit_account_id, credit_account_id, amount, member_id, reference_type, reference_id, created_at, applied_financial_year, posting_year, posting_type, category, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      for (const entry of ledgerEntries) {
        await db.run(stmt, Object.values(entry));
      }
      
      await db.run('COMMIT');
      res.json({ success: true, count: ledgerEntries.length });
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }

  } catch (err) {
    console.error('Batch assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Apply current-year assessment for a single member (for new members)
app.post('/api/member/:id/assess-current-year', authenticateToken, async (req, res) => {
  try {
    const memberId = req.params.id;
    const body = req.body || {};
    const year = body.year || new Date().getFullYear();

    const member = await db.get('SELECT * FROM member WHERE id = ? AND status = ?', [memberId, 'ACTIVE']);
    if (!member) {
      return res.status(404).json({ error: 'Member not found or not active' });
    }

    const configs = await db.all('SELECT * FROM dues_config');
    if (!configs || configs.length === 0) {
      return res.status(400).json({ error: 'No dues configuration defined' });
    }

    const fundMap = {
      NATIONAL: 'acc-fund-national',
      UNIT: 'acc-fund-unit',
      WELFARE: 'acc-fund-welfare',
      DEVELOPMENT: 'acc-fund-development'
    };

    const categoryMap = {
      NATIONAL: 'NATIONAL_DUE',
      UNIT: 'UNIT_DUE',
      WELFARE: 'WELFARE_DUE',
      DEVELOPMENT: 'DEVELOPMENT_LEVY'
    };

    const allocations = configs.map((config) => {
      const annualAmt =
        config.billing_frequency === 'ANNUAL'
          ? config.amount
          : config.amount * 12;

      return {
        account: fundMap[config.due_type] || 'acc-fund-unit',
        amount: annualAmt,
        description: `${config.due_type} Dues`,
        category: categoryMap[config.due_type] || 'DUES'
      };
    });

    const referenceId = `year-assessment-${year}-${Date.now()}`;
    const postingYear = new Date().getFullYear();
    const today = new Date().toISOString();
    const entryDate = `${year}-01-01`;

    await db.run('BEGIN TRANSACTION');
    try {
      const stmt = `
        INSERT OR REPLACE INTO ledger_entry (
          id, entry_date, effective_date, description,
          debit_account_id, credit_account_id, amount, member_id,
          reference_type, reference_id, created_at, applied_financial_year,
          posting_year, posting_type, category, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      let idx = 0;
      for (const alloc of allocations) {
        const exists = await db.get(
          'SELECT 1 as has FROM ledger_entry WHERE member_id = ? AND applied_financial_year = ? AND posting_type = ? AND credit_account_id = ?',
          [memberId, year, 'CURRENT_YEAR_CHARGE', alloc.account]
        );
        if (exists && exists.has) {
          continue;
        }

        const id = `l-year-${year}-${memberId}-split-${idx}`;
        const label = alloc.description.replace(' Dues', ' Due');
        const description = `${year} ${label} Assessment`;

        await db.run(stmt, [
          id,
          entryDate,
          entryDate,
          description,
          'acc-member-receivable',
          alloc.account,
          alloc.amount,
          memberId,
          'AUTO_DEBIT_SINGLE',
          referenceId,
          today,
          year,
          postingYear,
          'CURRENT_YEAR_CHARGE',
          alloc.category,
          'POSTED'
        ]);
        idx += 1;
      }

      await db.run('COMMIT');
      res.json({ success: true, count: allocations.length });
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }
  } catch (err) {
    console.error('Single-member assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generic CRUD endpoints
const tables = ['member', 'payment', 'ledger_entry', 'expense', 'dues_config', 'audit_log'];

tables.forEach(table => {
  // GET all
  app.get(`/api/${table}`, async (req, res) => {
    try {
      const rows = await db.all(`SELECT * FROM ${table}`);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST (Insert)
  app.post(`/api/${table}`, async (req, res) => {
    try {
      const data = req.body;
      const keys = Object.keys(data);
      // Convert camelCase to snake_case for DB
      const toSnake = (k) => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      const dbKeys = keys.map(toSnake);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(',');
      
      const sql = `INSERT OR REPLACE INTO ${table} (${dbKeys.join(',')}) VALUES (${placeholders})`;
      
      await db.run(sql, values);
      res.json({ success: true });
    } catch (err) {
      console.error(`Error inserting into ${table}:`, err);
      res.status(500).json({ error: err.message });
    }
  });
});

// Specific endpoints for actions (mimicking StorageService logic)

// Delete member
app.delete('/api/member/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM member WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update payment status
app.put('/api/payment/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.run('UPDATE payment SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reverse Payment (Immutable Ledger Approach)
app.post('/api/payment/:id/reverse', async (req, res) => {
    try {
        const { adminId, reason } = req.body;
        const paymentId = req.params.id;
        
        const payment = await db.get('SELECT * FROM payment WHERE id = ?', [paymentId]);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status === 'REVERSED') return res.status(400).json({ error: 'Payment already reversed' });

        const now = new Date().toISOString();
        
        // 1. Mark original payment as REVERSED
        await db.run(`
            UPDATE payment 
            SET status = 'REVERSED', 
                correction_reason = ?, 
                corrected_by = ?, 
                corrected_at = ? 
            WHERE id = ?`, 
            [reason, adminId, now, paymentId]
        );

        // 2. Create Contra Entry in Ledger
        // Determine accounts based on payment logic (simplified here, mirroring storageService)
        const currentYear = new Date().getFullYear();
        const appliedYear = payment.applied_financial_year || new Date(payment.payment_date).getFullYear();
        const isArrears = appliedYear < currentYear;
        
        const contraEntryId = `l-rev-${Date.now()}`;
        const contraEntry = {
            id: contraEntryId,
            entry_date: now.split('T')[0], // Today
            effective_date: payment.payment_date,
            description: `REVERSAL of Payment ${payment.reference_number}: ${reason}`,
            debit_account_id: isArrears ? 'acc-member-arrears' : 'acc-member-receivable', // Swap Debit/Credit
            credit_account_id: 'acc-bank',
            amount: payment.amount,
            member_id: payment.member_id,
            reference_type: 'PAYMENT_REVERSAL',
            reference_id: payment.id,
            created_at: now,
            applied_financial_year: appliedYear,
            posting_type: 'PAYMENT_REVERSAL'
        };

        await db.run(`
            INSERT INTO ledger_entry (
                id, entry_date, effective_date, description, 
                debit_account_id, credit_account_id, amount, member_id, 
                reference_type, reference_id, created_at, applied_financial_year, posting_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            Object.values(contraEntry)
        );

        // Audit Log
        const auditId = `aud-${Date.now()}`;
        await db.run(`
            INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, timestamp) 
            VALUES (?, ?, 'REVERSE_PAYMENT', 'PAYMENT', ?, ?)`,
            [auditId, adminId, paymentId, now]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Reverse payment failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Reclassify Payment (Correction = Reversal + Repost)
app.post('/api/payment/:id/reclassify', async (req, res) => {
    try {
        const { adminId, reason, newDate, newFinancialYear } = req.body;
        const paymentId = req.params.id;

        const payment = await db.get('SELECT * FROM payment WHERE id = ?', [paymentId]);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status === 'REVERSED') return res.status(400).json({ error: 'Payment already reversed' });

        const now = new Date().toISOString();

        // 1. Reverse Original Payment
        await db.run(`
            UPDATE payment 
            SET status = 'REVERSED', 
                correction_reason = ?, 
                corrected_by = ?, 
                corrected_at = ? 
            WHERE id = ?`, 
            [reason, adminId, now, paymentId]
        );

        // 2. Create Contra Entry
        const currentYear = new Date().getFullYear();
        const oldAppliedYear = payment.applied_financial_year || new Date(payment.payment_date).getFullYear();
        const wasArrears = oldAppliedYear < currentYear;

        const contraEntryId = `l-rev-${Date.now()}`;
        await db.run(`
            INSERT INTO ledger_entry (
                id, entry_date, effective_date, description, 
                debit_account_id, credit_account_id, amount, member_id, 
                reference_type, reference_id, created_at, applied_financial_year, posting_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                contraEntryId, 
                now.split('T')[0], 
                payment.payment_date, 
                `REVERSAL (CORRECTION) of Payment ${payment.reference_number}: ${reason}`,
                wasArrears ? 'acc-member-arrears' : 'acc-member-receivable',
                'acc-bank',
                payment.amount,
                payment.member_id,
                'PAYMENT_REVERSAL',
                paymentId,
                now,
                oldAppliedYear,
                'PAYMENT_REVERSAL'
            ]
        );

        // 3. Create New Corrected Payment
        const newPaymentId = `p-cor-${Date.now()}`;
        const newAppliedYear = newFinancialYear || new Date(newDate).getFullYear();
        
        await db.run(`
            INSERT INTO payment (
                id, member_id, member_name, amount, payment_date, 
                payment_method, payment_type, reference_number, status, 
                notes, created_at, applied_financial_year, reversal_reference_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newPaymentId,
                payment.member_id,
                payment.member_name,
                payment.amount,
                newDate,
                payment.payment_method,
                payment.payment_type,
                payment.reference_number, // Keep same ref number? Or append -COR? Keeping same is usually better for tracking, but uniqueness constraint? Ref number isn't unique in schema.
                'VERIFIED', // Auto-verified
                `CORRECTION of ${payment.reference_number}. ${reason}`,
                now,
                newAppliedYear,
                paymentId // Link back to original
            ]
        );

        // 4. Create New Ledger Entry
        const isNewArrears = newAppliedYear < currentYear;
        const newLedgerId = `l-pay-${Date.now()}`;
        
        await db.run(`
            INSERT INTO ledger_entry (
                id, entry_date, effective_date, description, 
                debit_account_id, credit_account_id, amount, member_id, 
                reference_type, reference_id, created_at, applied_financial_year, posting_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newLedgerId,
                newDate,
                newDate,
                `Payment (${payment.payment_type || 'General'}): ${payment.reference_number} (CORRECTED)`,
                'acc-bank',
                isNewArrears ? 'acc-member-arrears' : 'acc-member-receivable',
                payment.amount,
                payment.member_id,
                'PAYMENT',
                newPaymentId,
                now,
                newAppliedYear,
                isNewArrears ? 'ARREARS_SETTLEMENT' : 'GENERAL_PAYMENT'
            ]
        );

        // Audit Log
        const auditId = `aud-${Date.now()}`;
        await db.run(`
            INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, timestamp) 
            VALUES (?, ?, 'RECLASSIFY_PAYMENT', 'PAYMENT', ?, ?)`,
            [auditId, adminId, newPaymentId, now]
        );

        res.json({ success: true, newPaymentId });
    } catch (err) {
        console.error("Reclassify payment failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update expense status
app.put('/api/expense/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.run('UPDATE expense SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset system
app.post('/api/reset', async (req, res) => {
    try {
        // Drop tables or delete all rows? Delete all rows is safer to keep schema
        await db.run('DELETE FROM member');
        await db.run('DELETE FROM payment');
        await db.run('DELETE FROM ledger_entry');
        await db.run('DELETE FROM expense');
        await db.run('DELETE FROM dues_config');
        await db.run('DELETE FROM audit_log');
        // Re-seed
        await db.seed();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset all numeric values to zero while preserving members
app.post('/api/reset-zero', async (req, res) => {
    try {
        await db.run('UPDATE member SET previous_balance = 0');
        await db.run('DELETE FROM payment');
        await db.run('DELETE FROM ledger_entry');
        await db.run('DELETE FROM expense');
        await db.run('DELETE FROM audit_log');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/members/bulk_upsert', async (req, res) => {
    try {
        const { members } = req.body || {};
        if (!Array.isArray(members)) {
            return res.status(400).json({ error: 'members array required' });
        }
        const toSnake = (k) => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        for (const data of members) {
            const keys = Object.keys(data);
            const dbKeys = keys.map(toSnake);
            const values = Object.values(data);
            const placeholders = keys.map(() => '?').join(',');
            const sql = `INSERT OR REPLACE INTO member (${dbKeys.join(',')}) VALUES (${placeholders})`;
            await db.run(sql, values);
        }
        res.json({ success: true, count: members.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
