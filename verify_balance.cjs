const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/Unit48_Ps.sqlite');

db.serialize(() => {
  console.log("Checking member 02-15103...");
  db.all("SELECT id, full_name, membership_id, previous_balance FROM member WHERE membership_id = '02-15103'", (err, rows) => {
    if (err) {
      console.error("Error fetching member:", err);
      return;
    }
    console.log('Member Record:', rows);

    if (rows.length > 0) {
        const memberId = rows[0].id;
        console.log(`Checking ledger entries for member ID ${memberId}...`);
        db.all("SELECT * FROM ledger_entry WHERE member_id = ? AND posting_type = 'OPENING_BALANCE'", [memberId], (err, ledgerRows) => {
          if (err) {
            console.error("Error fetching ledger entries:", err);
            return;
          }
          console.log('Ledger Entries Found:', ledgerRows.length);
          console.log(ledgerRows);
        });
      }
  });
});
