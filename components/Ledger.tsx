
import React from 'react';
import { Member, LedgerEntry, UserRole } from '../types';
import { StorageService } from '../services/storageService';

interface LedgerProps {
  user: Member;
  setActiveTab: (tab: string) => void;
}

const Ledger: React.FC<LedgerProps> = ({ user, setActiveTab }) => {
  const allLedgerEntries = StorageService.getData<LedgerEntry>('u48_ledger');
  
  // Group by Financial Year and calculate isolated balances
  const processedEntries = React.useMemo(() => {
    const userEntries = allLedgerEntries.filter(entry => entry.memberId === user.id);
    const entriesByYear: Record<number, LedgerEntry[]> = {};

    // Group
    userEntries.forEach(entry => {
      const year = entry.appliedFinancialYear || new Date(entry.entryDate).getFullYear();
      if (!entriesByYear[year]) entriesByYear[year] = [];
      entriesByYear[year].push(entry);
    });

    let results: any[] = [];

    // Process each year bucket
    Object.keys(entriesByYear).forEach(yearStr => {
      const year = parseInt(yearStr);
      // Sort Ascending for calculation
      const sorted = entriesByYear[year].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
      
      let yearBalance = 0;
      const calculated = sorted.map(entry => {
        // Debit (Due) increases balance (Debt), Credit (Payment) decreases it
        const isPayment = entry.referenceType === 'PAYMENT';
        const change = isPayment ? -entry.amount : entry.amount;
        yearBalance += change;
        
        return { 
          ...entry, 
          balance: yearBalance,
          displayYear: year
        };
      });
      results = [...results, ...calculated];
    });

    // Sort Descending for Display (Newest first)
    return results.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }, [allLedgerEntries, user.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Personal Ledger</h2>
          <p className="text-slate-500">Period-isolated history of all dues and payments.</p>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={user.role === UserRole.MEMBER}
            onClick={() => { if (user.role !== UserRole.MEMBER) setActiveTab('payments'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors ${
              user.role === UserRole.MEMBER 
              ? 'bg-indigo-300 text-white cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Submit Payment Record
          </button>
          <button className="flex items-center gap-2 bg:white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Applied Year</th>
                <th className="px-6 py-4">Posting Year</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Debit (Due)</th>
                <th className="px-6 py-4 text-right">Credit (Paid)</th>
                <th className="px-6 py-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedEntries.length > 0 ? (
                processedEntries.map(entry => (
                  <tr key={entry.id} className="text-sm hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono">{entry.entryDate}</td>
                    <td className="px-6 py-4 font-bold text-slate-600 text-center">{entry.appliedFinancialYear || '-'}</td>
                    <td className="px-6 py-4 text-slate-500 text-center">{new Date(entry.entryDate).getFullYear()}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{entry.description}</td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">{entry.postingType?.replace('_', ' ') || '-'}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-600">
                      {entry.referenceType !== 'PAYMENT' ? `₦${entry.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-600">
                      {entry.referenceType === 'PAYMENT' ? `₦${entry.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className={`px-6 py-4 text-right font-mono font-bold ${entry.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      ₦{entry.balance.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No transactions found in your live ledger.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <div className="text-sm text-indigo-800">
          <p className="font-bold mb-1">Live Transaction Integrity</p>
          <p>This ledger is derived from the Unit 48 core accounting engine. All entries are immutable. If you spot a discrepancy, please contact the Unit Admin for an adjustment entry.</p>
        </div>
      </div>
    </div>
  );
};

export default Ledger;
