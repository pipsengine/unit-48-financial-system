
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db.cjs');

const app = express();
const PORT = 3005;

app.use(cors());
app.use(bodyParser.json());

// Sync endpoint to get all data at once
app.get('/api/sync', async (req, res) => {
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


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
