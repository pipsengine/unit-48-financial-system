const db = require('./server/db.cjs');

async function checkTable() {
  try {
    const rows = await db.all("PRAGMA table_info(password_resets)");
    console.log('Columns in password_resets:', rows);
  } catch (err) {
    console.error(err);
  }
}

checkTable();
