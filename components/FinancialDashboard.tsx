import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { MemberStatus, LedgerEntry, DueConfig } from '../types';

const FinancialDashboard: React.FC = () => {
  const [members, setMembers] = useState(StorageService.getMembers().filter(m => m.status === MemberStatus.ACTIVE));
  const [ledger, setLedger] = useState(StorageService.getData<LedgerEntry>('ledger_entry'));
  const [duesConfig, setDuesConfig] = useState(StorageService.getData<DueConfig>('dues_config'));

  useEffect(() => {
    const refreshData = () => {
      setMembers(StorageService.getMembers().filter(m => m.status === MemberStatus.ACTIVE));
      setLedger(StorageService.getData<LedgerEntry>('ledger_entry'));
      setDuesConfig(StorageService.getData<DueConfig>('dues_config'));
    };

    const unsubscribe = StorageService.subscribe(refreshData);
    return () => unsubscribe();
  }, []);
  
  // Determine available years from ledger, defaulting to current year if empty
  // Fixed: Ensure currentYear is not used as a variable, but derived dynamically
  const availableYears = useMemo<number[]>(() => {
    const years = new Set<number>();
    ledger.forEach(l => {
      if (typeof l.appliedFinancialYear === 'number') {
        years.add(l.appliedFinancialYear);
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [ledger]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || new Date().getFullYear());

  // 1. Overall Stats (Calculated for Selected Year)
  const overallStats = useMemo(() => {
    let fullyPaid = 0;
    let owing = 0;
    let totalArrears = 0;

    members.forEach(m => {
      // Calculate balance based on ledger entries for the selected year
      const yearEntries = ledger.filter(l => 
        l.memberId === m.id && 
        l.appliedFinancialYear === selectedYear
      );

      // Sum Debits (Charges)
      const charges = yearEntries
        .filter(l => l.debitAccountId.includes('member') || l.debitAccountId === m.id)
        .reduce((sum, e) => sum + e.amount, 0);

      // Sum Credits (Payments)
      const payments = yearEntries
        .filter(l => l.creditAccountId.includes('member') || l.creditAccountId === m.id)
        .reduce((sum, e) => sum + e.amount, 0);

      const yearBalance = charges - payments;

      if (yearBalance > 0) {
        owing++;
        totalArrears += yearBalance;
      } else {
        fullyPaid++;
      }
    });

    return { fullyPaid, owing, totalArrears };
  }, [members, ledger, selectedYear]);

  // 2. Per-Due Stats
  const duesStats = useMemo(() => {
    // Get unique due types from config
    const uniqueTypes = Array.from(new Set(duesConfig.map(d => d.dueType)));

    const categoryMap: Record<string, string> = {
      'NATIONAL': 'NATIONAL_DUE',
      'UNIT': 'UNIT_DUE',
      'WELFARE': 'WELFARE_DUE',
      'DEVELOPMENT': 'DEVELOPMENT_LEVY'
    };

    return uniqueTypes.map(type => {
       const category = categoryMap[String(type)] || String(type);
       let paidCount = 0;
       let owingCount = 0;

       members.forEach(m => {
          // Filter ledger for this member, selected year, and specific category
          const memberEntries = ledger.filter(l => 
             l.memberId === m.id && 
             (l.category === category || l.category === type) &&
             l.appliedFinancialYear === selectedYear
          );

          // Sum Debits (Charges)
          const charges = memberEntries
             .filter(l => l.debitAccountId.includes('member') || l.debitAccountId === m.id)
             .reduce((sum, e) => sum + e.amount, 0);

          // Sum Credits (Payments)
          const payments = memberEntries
             .filter(l => l.creditAccountId.includes('member') || l.creditAccountId === m.id)
             .reduce((sum, e) => sum + e.amount, 0);

          const balance = charges - payments;
          
          // If balance <= 0, they have paid fully (or overpaid)
          if (balance <= 0) paidCount++;
          else owingCount++;
       });

       return {
         type,
         paidCount,
         owingCount,
         total: paidCount + owingCount,
         completionRate: (paidCount + owingCount) > 0 ? (paidCount / (paidCount + owingCount)) * 100 : 0
       };
    });
  }, [members, ledger, duesConfig, selectedYear]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h2 className="text-2xl font-black text-slate-800 tracking-tight">Financial Compliance Dashboard</h2>
           <p className="text-slate-500 font-medium">Overview of member payments for {selectedYear}</p>
        </div>
        <div>
           <select 
             value={selectedYear} 
             onChange={(e) => setSelectedYear(Number(e.target.value))}
             className="bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
           >
             {availableYears.map(year => (
               <option key={year} value={year}>{year} Financial Year</option>
             ))}
           </select>
        </div>
      </div>

      {/* Overall Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Active Members</span>
           <div className="mt-2 flex items-baseline gap-2">
             <span className="text-3xl font-black text-slate-800">{members.length}</span>
           </div>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
           <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Fully Compliant (All Dues)</span>
           <div className="mt-2 flex items-baseline gap-2">
             <span className="text-3xl font-black text-emerald-700">{overallStats.fullyPaid}</span>
             <span className="text-sm font-bold text-emerald-500">
               ({members.length > 0 ? ((overallStats.fullyPaid / members.length) * 100).toFixed(1) : 0}%)
             </span>
           </div>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
           <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Owing Members</span>
           <div className="mt-2 flex items-baseline gap-2">
             <span className="text-3xl font-black text-rose-700">{overallStats.owing}</span>
             <span className="text-sm font-bold text-rose-500">
               ({members.length > 0 ? ((overallStats.owing / members.length) * 100).toFixed(1) : 0}%)
             </span>
           </div>
           <div className="mt-4 pt-4 border-t border-rose-100">
             <span className="text-xs font-bold text-rose-400 uppercase">Total Arrears</span>
             <div className="text-lg font-mono font-bold text-rose-600">₦{overallStats.totalArrears.toLocaleString()}</div>
           </div>
        </div>
      </div>

      {/* Per Due Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-700">Payment Status by Due Type</h3>
        </div>
        <div className="divide-y divide-slate-100">
           {duesStats.map(stat => (
             <div key={stat.type} className="p-6 hover:bg-slate-50 transition-colors">
               <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                     {stat.type.charAt(0)}
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-800">{stat.type.replace('_', ' ')} Due</h4>
                     <p className="text-xs text-slate-500">{selectedYear} Financial Year</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-2xl font-black text-slate-800">{stat.completionRate.toFixed(1)}%</div>
                   <div className="text-xs font-bold text-slate-400 uppercase">Completion Rate</div>
                 </div>
               </div>
               
               {/* Progress Bar */}
               <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex mb-4">
                 <div 
                   className="bg-emerald-500 h-full" 
                   style={{ width: `${stat.completionRate}%` }} 
                   title={`Paid: ${stat.paidCount}`}
                 />
                 <div 
                   className="bg-rose-400 h-full" 
                   style={{ width: `${100 - stat.completionRate}%` }} 
                   title={`Owing: ${stat.owingCount}`}
                 />
               </div>
               
               <div className="flex justify-between text-sm">
                 <div className="flex items-center gap-2">
                   <span className="w-3 h-3 rounded-full bg-emerald-500" />
                   <span className="font-medium text-slate-600">Paid: <span className="font-bold text-slate-900">{stat.paidCount}</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="w-3 h-3 rounded-full bg-rose-400" />
                   <span className="font-medium text-slate-600">Owing: <span className="font-bold text-slate-900">{stat.owingCount}</span></span>
                 </div>
               </div>
             </div>
           ))}
           {duesStats.length === 0 && (
             <div className="p-12 text-center text-slate-400">
               No dues configured for this year.
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
