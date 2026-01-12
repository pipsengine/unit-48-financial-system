
import React, { useMemo } from 'react';
import { UserRole, Member, LedgerEntry } from '../types';
import { StorageService } from '../services/storageService';

interface DashboardProps {
  user: Member;
  setActiveTab: (tab: string) => void;
  refreshDB: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const ledger = StorageService.getData<LedgerEntry>('u48_ledger');

  // Individual Aging Metrics
  const agingMetrics = useMemo(() => {
    const userEntries = ledger.filter(e => e.memberId === user.id);
    
    const totalAgingCredit = userEntries
      .filter(e => e.referenceType === 'PAYMENT')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalAgingDebit = userEntries
      .filter(e => e.referenceType !== 'PAYMENT')
      .reduce((sum, e) => sum + e.amount, 0);

    const currentAgingBalance = totalAgingCredit - totalAgingDebit;
    const totalOutstandingAging = user.balance < 0 ? Math.abs(user.balance) : 0;

    return {
      totalAgingCredit,
      totalAgingDebit,
      currentAgingBalance,
      totalOutstandingAging
    };
  }, [ledger, user.id, user.balance]);

  const getMemberStatus = (member: Member) => {
    const currentYear = new Date().getFullYear();
    const totalPaid = ledger
      .filter(e => e.memberId === member.id && e.referenceType === 'PAYMENT' && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);

    // Waterfall allocation logic (Based on SRS Appendix F)
    // Total Year: 21,600
    return {
      national: totalPaid >= 10000,
      development: totalPaid >= 12000,
      unit: totalPaid >= 18000,
      welfare: totalPaid >= 21600
    };
  };

  const status = getMemberStatus(user);

  return (
    <div className="space-y-8 pb-12">
      <section className="bg-slate-50 rounded-[2.5rem] p-1 border-2 border-slate-200 overflow-hidden shadow-2xl shadow-indigo-100/50">
        <div className="bg-white rounded-[2.3rem] p-8 shadow-inner">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-5">
              <div className="bg-indigo-600 text-white p-4 rounded-[1.5rem] shadow-xl shadow-indigo-200">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Personal Contribution Registry</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest">
                     FY 2026 Assessment Status
                  </p>
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                  <span className="text-indigo-600 font-black text-[10px] uppercase">{user.fullName}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                  <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Total Credit:</span>
                    <span className="text-[9px] font-black text-emerald-700">₦{agingMetrics.totalAgingCredit.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                    <span className="text-[9px] font-black text-rose-600 uppercase tracking-tighter">Outstanding Aging:</span>
                    <span className="text-[9px] font-black text-rose-700">₦{agingMetrics.totalOutstandingAging.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <LegendItem color="bg-emerald-500" label="PAID" />
              <LegendItem color="bg-rose-500" label="DUE" />
              <LegendItem color="bg-red-600" label="ARREARS" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <ContributionCard label="National Due" paid={status.national} amount="10,000" icon="🇳" />
            <ContributionCard label="Development Levy" paid={status.development} amount="2,000" icon="🏗️" />
            <ContributionCard label="Unit Monthly Dues" paid={status.unit} amount="6,000" icon="🏠" />
            <ContributionCard label="Welfare Monthly Dues" paid={status.welfare} amount="3,600" icon="🤝" />
            
            {/* Dedicated Red Card for Total Outstanding Aging */}
            <div className="p-6 rounded-[2rem] border-2 border-red-200 bg-red-50 shadow-xl shadow-red-100/50 transition-all flex flex-col justify-between h-48 relative overflow-hidden group hover:scale-[1.02]">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex flex-col">
                  <span className="text-2xl mb-2">⚠️</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Total Outstanding Aging</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
              </div>
              <div className="text-right relative z-10">
                <p className="text-xs font-black mb-1 text-red-600">IMMEDIATE ATTENTION</p>
                <h4 className="text-2xl font-black tracking-tighter text-red-900">₦{agingMetrics.totalOutstandingAging.toLocaleString()}</h4>
                <p className="text-[9px] font-bold uppercase tracking-widest text-red-400">Aging Arrears</p>
              </div>
              <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-red-500 blur-2xl opacity-20" />
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl border ${user.balance < 0 ? 'bg-rose-50 border-rose-100 shadow-rose-50' : 'bg-emerald-50 border-emerald-100 shadow-emerald-50'} shadow-lg`}>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Aging Standing (Net)</p>
                   <h4 className={`text-2xl font-black ${user.balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                     ₦{Math.abs(user.balance).toLocaleString()} {user.balance < 0 ? 'Outstanding Aging' : 'Aging Credit'}
                   </h4>
                   <div className="mt-2 flex gap-4 text-[9px] font-bold uppercase tracking-tighter">
                      <div className="flex items-center gap-1 text-emerald-600">
                        <span>Total Lifetime Credits:</span>
                        <span>₦{agingMetrics.totalAgingCredit.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-500">
                        <span>Total Lifetime Debits:</span>
                        <span>₦{agingMetrics.totalAgingDebit.toLocaleString()}</span>
                      </div>
                   </div>
                </div>
             </div>
             <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 text-slate-500 text-xs italic max-w-md">
                "Dues are allocated via a <strong>waterfall protocol</strong>. Aging standing reflects your total lifetime financial health within the unit, reconciling all credits against historical assessments."
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ContributionCard = ({ label, paid, amount, icon }: { label: string, paid: boolean, amount: string, icon: string }) => {
  return (
    <div className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col justify-between h-48 relative overflow-hidden group hover:scale-[1.02] ${
      paid 
        ? 'bg-emerald-50 border-emerald-200 shadow-xl shadow-emerald-100/50' 
        : 'bg-rose-50 border-rose-200 shadow-xl shadow-rose-100/50'
    }`}>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <span className="text-2xl mb-2">{icon}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${paid ? 'text-emerald-700' : 'text-rose-700'}`}>{label}</span>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${paid ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {paid ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          )}
        </div>
      </div>
      <div className="text-right relative z-10">
        <p className={`text-xs font-black mb-1 ${paid ? 'text-emerald-600' : 'text-rose-500'}`}>{paid ? 'SETTLED' : 'OUTSTANDING'}</p>
        <p className={`text-2xl font-black tracking-tighter ${paid ? 'text-emerald-800' : 'text-rose-800'}`}>₦{amount}</p>
        <p className={`text-[9px] font-bold uppercase tracking-widest ${paid ? 'text-emerald-400' : 'text-rose-400'}`}>Current Cycle</p>
      </div>
      
      {/* Decorative BG element */}
      <div className={`absolute -bottom-6 -left-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${paid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
    </div>
  );
};

const LegendItem = ({ color, label }: { color: string, label: string }) => (
  <div className="flex items-center gap-2">
    <div className={`w-3 h-3 ${color} rounded-sm shadow-sm`} />
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
  </div>
);

export default Dashboard;
