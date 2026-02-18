const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/Unit48_Ps.sqlite');

db.serialize(() => {
  console.log("Checking for expenses with member_id...");
  db.all("SELECT * FROM ledger_entry WHERE posting_type = 'EXPENSE' AND member_id IS NOT NULL", (err, rows) => {
    if (err) {
      console.error("Error:", err);
      return;
    }
    console.log('Bad Expenses Count:', rows.length);
    if (rows.length > 0) console.log(rows);
  });
});
