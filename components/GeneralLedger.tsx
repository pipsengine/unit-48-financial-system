import React, { useState, useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { Member, LedgerEntry, PostingType } from '../types';

interface GeneralLedgerProps {
  user?: Member;
  refreshDB?: () => void;
}

const GeneralLedger: React.FC<GeneralLedgerProps> = ({ user, refreshDB }) => {
  const [filterMemberId, setFilterMemberId] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterPostingType, setFilterPostingType] = useState<string>('');
  const [showTools, setShowTools] = useState(false);
  const [toolsYear, setToolsYear] = useState<string>(new Date().getFullYear().toString());

  const members = StorageService.getMembers();
  const allEntries = StorageService.getData<LedgerEntry>('ledger_entry');
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const handleGenerateAssessment = async () => {
      const year = parseInt(toolsYear);
      if (isNaN(year) || year < 2000 || year > 2100) {
          alert("Invalid year.");
          return;
      }
      if (!confirm(`Are you sure you want to generate ANNUAL ASSESSMENTS for ${year}?\n\nThis will create a debit entry for every active member.`)) return;
      
      try {
          await StorageService.applyFullYearAssessment(year);
          alert(`Successfully generated assessments for ${year}.`);
          if (refreshDB) refreshDB();
          // Force re-render or just let StorageService listeners handle it (if subscribed, but we rely on prop update usually)
          window.location.reload(); // Simplest for now
      } catch (e) {
          alert("Failed to generate assessments.");
          console.error(e);
      }
  };


  const financialYears = useMemo(() => {
    const years = new Set(allEntries.map(e => e.appliedFinancialYear || new Date(e.entryDate).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [allEntries]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      const entryYear = entry.appliedFinancialYear || new Date(entry.entryDate).getFullYear();
      
      // Filter by Member
      if (filterMemberId && entry.memberId !== filterMemberId) return false;
      
      // Filter by Date Range
      if (filterStartDate && entry.entryDate < filterStartDate) return false;
      if (filterEndDate && entry.entryDate > filterEndDate) return false;
      
      // Filter by Financial Year
      if (filterYear && entryYear.toString() !== filterYear) return false;

      // Filter by Posting Type
      if (filterPostingType && entry.postingType !== filterPostingType) return false;

      return true;
    }).sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }, [allEntries, filterMemberId, filterStartDate, filterEndDate, filterYear, filterPostingType]);

  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      // Logic: Show everything. 
      // If debitAccountId != 'acc-bank', it is a Debit (Charge, Expense).
      // If creditAccountId != 'acc-bank', it is a Credit (Payment, Income).
      
      const isDebit = entry.debitAccountId !== 'acc-bank';
      const isCredit = entry.creditAccountId !== 'acc-bank';

      if (isDebit) {
          acc.debits += entry.amount;
      }
      if (isCredit) {
          acc.credits += entry.amount;
      }
      return acc;
    }, { debits: 0, credits: 0 });
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">General Ledger</h2>
          <p className="text-slate-500 font-medium">Global financial records across all members</p>
        </div>
        <div className="flex gap-2 items-center">
          {isAdmin && (
              <button 
                  onClick={() => setShowTools(!showTools)}
                  className="mr-2 px-3 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs uppercase rounded-lg border border-indigo-200 hover:bg-indigo-100"
              >
                  {showTools ? 'Hide Tools' : 'Fin. Year Tools'}
              </button>
          )}
          <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase block">Total Debits</span>
            <span className="text-lg font-mono font-bold text-red-600">₦{totals.debits.toLocaleString()}</span>
          </div>
          <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase block">Total Credits</span>
            <span className="text-lg font-mono font-bold text-emerald-600">₦{totals.credits.toLocaleString()}</span>
          </div>
          <div className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase block">Net Balance</span>
            <span className={`text-lg font-mono font-bold ${totals.credits - totals.debits < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              ₦{Math.abs(totals.credits - totals.debits).toLocaleString()} {(totals.credits - totals.debits) >= 0 ? 'Cr' : 'Dr'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Tools Panel */}
      {showTools && isAdmin && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 shadow-sm animate-in slide-in-from-top-4 duration-300">
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Financial Year Administration
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-lg border border-indigo-100">
                      <h4 className="font-bold text-slate-800 mb-2">Generate Annual Assessments</h4>
                      <p className="text-xs text-slate-500 mb-4">Creates a "Current Year Charge" debit for all active members for the selected year. Use this if a year has payments but no dues.</p>
                      
                      <div className="flex gap-2">
                          <input 
                              type="number" 
                              value={toolsYear}
                              onChange={(e) => setToolsYear(e.target.value)}
                              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-center font-mono font-bold"
                              placeholder="YYYY"
                          />
                          <button 
                              onClick={handleGenerateAssessment}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md"
                          >
                              Generate Dues for {toolsYear}
                          </button>
                      </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-indigo-100 opacity-60 grayscale cursor-not-allowed">
                      <h4 className="font-bold text-slate-800 mb-2">Import Opening Balances</h4>
                      <p className="text-xs text-slate-500 mb-4">Bulk import outstanding arrears from previous system. (Coming Soon)</p>
                      <button disabled className="bg-slate-100 text-slate-400 px-4 py-2 rounded-lg font-bold text-sm">
                          Import Tool Unavailable
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter by Member</label>
          <select 
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.fullName} ({m.membershipId})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
          <input 
            type="date" 
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Date</label>
          <input 
            type="date" 
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Financial Year</label>
          <select 
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Years</option>
            {financialYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Posting Type</label>
          <select 
            value={filterPostingType}
            onChange={(e) => setFilterPostingType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            {Object.values(PostingType).map(type => (
              <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Fin. Year</th>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Debit</th>
                <th className="px-6 py-4 text-right">Credit</th>
                <th className="px-6 py-4 text-right">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(entry => {
                  const member = members.find(m => m.id === entry.memberId);
                  return (
                    <tr key={entry.id} className="text-sm hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">{entry.entryDate}</td>
                      <td className="px-6 py-4 font-bold text-slate-600 text-center">{entry.appliedFinancialYear || '-'}</td>
                      <td className="px-6 py-4 text-slate-500 text-center">{new Date(entry.entryDate).getFullYear()}</td>
                      <td className="px-6 py-4">
                        {member ? (
                          <div>
                            <div className="font-bold text-slate-700">{member.fullName}</div>
                            <div className="text-xs text-slate-400">{member.membershipId}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">System / Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{entry.description}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          entry.postingType === PostingType.ARREARS_SETTLEMENT ? 'bg-orange-100 text-orange-700' :
                          entry.postingType === PostingType.CURRENT_YEAR_CHARGE ? 'bg-indigo-100 text-indigo-700' :
                          entry.postingType === PostingType.EXPENSE ? 'bg-rose-100 text-rose-700' :
                          entry.postingType === PostingType.OPENING_BALANCE ? 'bg-slate-100 text-slate-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {entry.postingType?.replace(/_/g, ' ') || 'GENERAL'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-red-600 whitespace-nowrap">
                        {(entry.debitAccountId !== 'acc-bank') ? `₦${entry.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600 whitespace-nowrap">
                        {(entry.creditAccountId !== 'acc-bank') ? `₦${entry.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">
                         {entry.referenceType}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No ledger entries found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GeneralLedger;
