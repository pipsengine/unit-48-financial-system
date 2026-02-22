import React, { useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { LedgerEntry } from '../types';

const TrialBalance: React.FC = () => {
  const entries = StorageService.getData<LedgerEntry>('ledger_entry');
  const members = StorageService.getMembers();

  const getAccountName = (id: string) => {
    if (!id) return 'Unknown Account';
    if (id === 'acc-bank') return 'Cash at Bank';
    if (id === 'acc-receivable-control') return 'Accounts Receivable (Members Control)';
    if (id === 'acc-dues-clearing') return 'Dues Clearing Account';
    if (id === 'acc-payable-clearing') return 'Accounts Payable';
    if (id === 'acc-opening-balance') return 'Opening Balance Equity';
    
    if (id.startsWith('acc-fund-')) {
      const fund = id.replace('acc-fund-', '');
      return fund.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') + ' Fund';
    }
    
    if (id.startsWith('acc-expense-')) {
       const exp = id.replace('acc-expense-', '');
       return 'Expense: ' + exp.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }
    
    if (id.startsWith('acc-income-')) {
        const inc = id.replace('acc-income-', '');
        return 'Income: ' + inc.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }

    return id;
  };

  const accountBalances = useMemo(() => {
    const balances: Record<string, { debit: number; credit: number }> = {};

    entries.forEach(entry => {
      // Normalize Account IDs
      const normalize = (id: string) => {
        if (!id) return 'unknown';
        if (id.includes('member') || members.some(m => m.id === id)) {
          return 'acc-receivable-control';
        }
        return id;
      };

      const debitAcc = normalize(entry.debitAccountId);
      const creditAcc = normalize(entry.creditAccountId);

      if (!balances[debitAcc]) balances[debitAcc] = { debit: 0, credit: 0 };
      if (!balances[creditAcc]) balances[creditAcc] = { debit: 0, credit: 0 };

      balances[debitAcc].debit += entry.amount;
      balances[creditAcc].credit += entry.amount;
    });

    return balances;
  }, [entries, members]);

  const sortedAccounts = Object.keys(accountBalances).sort((a, b) => {
      return getAccountName(a).localeCompare(getAccountName(b));
  });

  const totals = (Object.values(accountBalances) as Array<{ debit: number; credit: number }>).reduce<{ debit: number; credit: number }>(
    (acc, b) => ({
      debit: acc.debit + b.debit,
      credit: acc.credit + b.credit
    }),
    { debit: 0, credit: 0 }
  );

  const isBalanced = Math.abs(totals.debit - totals.credit) < 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Trial Balance</h2>
          <p className="text-slate-500 font-medium">As of {new Date().toLocaleDateString()}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
           <span className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-emerald-500' : 'bg-rose-500'}`} />
           <span className="text-sm font-bold uppercase tracking-wider">{isBalanced ? 'Balanced' : 'Unbalanced'}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">Account Name</th>
              <th className="px-6 py-4 text-right">Debit</th>
              <th className="px-6 py-4 text-right">Credit</th>
              <th className="px-6 py-4 text-right">Net Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedAccounts.map(accId => {
              const { debit, credit } = accountBalances[accId];
              const net = debit - credit; // Debit Balance = Debit - Credit
              const isDebitBalance = net > 0;
              
              if (debit === 0 && credit === 0) return null;

              return (
                <tr key={accId} className="text-sm hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {getAccountName(accId)}
                    <span className="block text-[10px] text-slate-400 font-mono">{accId}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-600">
                    {debit > 0 ? `₦${debit.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-600">
                    {credit > 0 ? `₦${credit.toLocaleString()}` : '-'}
                  </td>
                   <td className={`px-6 py-4 text-right font-mono font-bold ${isDebitBalance ? 'text-indigo-600' : (net < 0 ? 'text-emerald-600' : 'text-slate-400')}`}>
                    ₦{Math.abs(net).toLocaleString()} {isDebitBalance ? 'Dr' : (net === 0 ? '-' : 'Cr')}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                <td className="px-6 py-4 text-slate-800 uppercase tracking-wider">Total</td>
                <td className="px-6 py-4 text-right font-mono text-slate-800">₦{totals.debit.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-mono text-slate-800">₦{totals.credit.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-mono text-slate-400">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrialBalance;
