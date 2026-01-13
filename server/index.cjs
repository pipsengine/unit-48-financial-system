
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db.cjs');

const crypto = require('crypto');

const app = express();
const PORT = 3005;

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
    // Check if identifier matches email or membershipId
    const member = await db.get(
      'SELECT * FROM member WHERE email = ? OR membership_id = ?', 
      [identifier, identifier]
    );

    if (!member) {
      // For security, we might not want to reveal if user exists, but for internal app it's fine.
      // Let's pretend success to avoid enumeration if we were strict, but here we can be helpful.
      // Actually, sticking to standard practice: "If that account exists, we sent an email."
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 mins

    await db.run(
      'INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)',
      [token, member.id, expiresAt]
    );

    // SIMULATE EMAIL SENDING
    console.log('---------------------------------------------------');
    console.log(`[EMAIL SIMULATION] Password Reset Requested for ${member.full_name}`);
    console.log(`[EMAIL SIMULATION] Link: http://localhost:3000/?reset_token=${token}`);
    console.log('---------------------------------------------------');

    res.json({ success: true, message: 'Reset link sent to server console.' });
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

    res.json({ success: true });
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
