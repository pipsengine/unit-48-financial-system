const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/Unit48_Ps.sqlite');

db.serialize(async () => {
  console.log("Starting Opening Balance Migration...");

  // Get all members with non-zero previous_balance
  db.all("SELECT * FROM member WHERE previous_balance IS NOT NULL AND previous_balance != 0", async (err, members) => {
    if (err) {
      console.error("Error fetching members:", err);
      return;
    }

    console.log(`Found ${members.length} members with previous balance.`);

    for (const member of members) {
      // Check if ledger entry exists
      db.get("SELECT 1 as has FROM ledger_entry WHERE member_id = ? AND posting_type = 'OPENING_BALANCE'", [member.id], (err, row) => {
        if (err) return console.error(err);

        if (!row) {
          console.log(`Creating Opening Balance Ledger Entry for ${member.full_name} (${member.membership_id}): ${member.previous_balance}`);
          
          const amount = member.previous_balance;
          const isSurplus = amount > 0;
          const absAmount = Math.abs(amount);
          const entryDate = new Date().toISOString().split('T')[0];
          const effectiveDate = member.date_of_joining || entryDate;
          const year = new Date(effectiveDate).getFullYear();
          const refId = `opening-bal-${member.id}-${Date.now()}`;

          const drAccount = isSurplus ? 'acc-opening-balance-equity' : 'acc-member-arrears';
          const crAccount = isSurplus ? 'acc-member-arrears' : 'acc-opening-balance-equity';
          
          const description = isSurplus 
            ? `Opening Balance: Surplus/Credit B/F` 
            : `Opening Balance: Arrears/Debit B/F`;

          const entry1 = {
            id: `l-ob-${member.id}-${Date.now()}-1`,
            entry_date: entryDate,
            effective_date: effectiveDate,
            description: description,
            debit_account_id: drAccount,
            credit_account_id: crAccount,
            amount: absAmount,
            member_id: member.id,
            reference_type: 'OPENING_BALANCE',
            reference_id: refId,
            created_at: new Date().toISOString(),
            applied_financial_year: year,
            posting_year: new Date().getFullYear(),
            posting_type: 'OPENING_BALANCE',
            category: 'OUTSTANDING_ARREARS',
            status: 'POSTED'
          };

          const stmt = `INSERT INTO ledger_entry (
            id, entry_date, effective_date, description, debit_account_id, credit_account_id, amount, member_id, reference_type, reference_id, created_at, applied_financial_year, posting_year, posting_type, category, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          db.run(stmt, Object.values(entry1), (err) => {
            if (err) console.error("Error inserting ledger entry:", err);
            else console.log(`Success: Posted entry for ${member.membership_id}`);
          });
        } else {
          console.log(`Skipping ${member.membership_id}: Already has Opening Balance entry.`);
        }
      });
    }
  });
});
