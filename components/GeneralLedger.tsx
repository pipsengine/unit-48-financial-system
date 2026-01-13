import React, { useState, useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { Member, LedgerEntry, PostingType } from '../types';

const GeneralLedger: React.FC = () => {
  const [filterMemberId, setFilterMemberId] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterPostingType, setFilterPostingType] = useState<string>('');

  const members = StorageService.getMembers();
  const allEntries = StorageService.getData<LedgerEntry>('ledger_entry');

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
      if (entry.referenceType === 'PAYMENT') {
        acc.credits += entry.amount;
      } else {
        acc.debits += entry.amount;
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
        <div className="flex gap-2">
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
              ₦{(totals.credits - totals.debits).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

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
                          entry.postingType === PostingType.OPENING_BALANCE ? 'bg-slate-100 text-slate-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {entry.postingType?.replace(/_/g, ' ') || 'GENERAL'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-red-600 whitespace-nowrap">
                        {(entry.debitAccountId.startsWith('acc-member') || (entry.referenceType !== 'PAYMENT' && !entry.creditAccountId.startsWith('acc-member'))) ? `₦${entry.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600 whitespace-nowrap">
                        {(entry.creditAccountId.startsWith('acc-member') || entry.referenceType === 'PAYMENT') ? `₦${entry.amount.toLocaleString()}` : '-'}
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
