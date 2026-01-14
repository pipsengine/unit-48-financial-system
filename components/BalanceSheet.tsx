import React, { useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { Member, LedgerEntry, Expense, ExpenseStatus, DueConfig, DueType, BillingFrequency } from '../types';

const BalanceSheet: React.FC = () => {
  const members = StorageService.getMembers();
  const ledger = StorageService.getData<LedgerEntry>('ledger_entry');
  const expenses = StorageService.getData<Expense>('expense');
  const duesConfig = StorageService.getData<DueConfig>('dues_config');

  const financialData = useMemo(() => {
    // --- 1. ASSETS ---
    
    // Cash & Bank
    // Inflow: Debits to acc-bank
    const bankDebits = ledger
      .filter(e => e.debitAccountId === 'acc-bank')
      .reduce((sum, e) => sum + e.amount, 0);
    // Outflow: Expenses paid (Credits from acc-bank)
    const paidExpenses = expenses
      .filter(e => e.status === ExpenseStatus.PAID)
      .reduce((sum, e) => sum + e.amount, 0);
    const cashAtBank = bankDebits - paidExpenses;

    // Members' Arrears (Outstanding)
    // Sum of all negative balances (Debts)
    // We treat negative balance as Asset (Receivable)
    const arrears = members
      .reduce((sum, m) => {
        const totalBalance = m.balance + (m.arrearsBalance || 0);
        return totalBalance < 0 ? sum + Math.abs(totalBalance) : sum;
      }, 0);

    const totalAssets = cashAtBank + arrears;

    // --- 2. LIABILITIES ---

    // Dues Received in Advance
    // Sum of all positive balances (Credits)
    const prepaidDues = members
      .reduce((sum, m) => {
        const totalBalance = m.balance + (m.arrearsBalance || 0);
        return totalBalance > 0 ? sum + totalBalance : sum;
      }, 0);

    // Unpaid Obligations
    // Expenses approved but not yet paid
    const unpaidExpenses = expenses
      .filter(e => e.status === ExpenseStatus.APPROVED)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalLiabilities = prepaidDues + unpaidExpenses;

    // --- 3. FUNDS & EQUITY ---
    
    // Calculate Fund Balances from Ledger (Cash Basis Recognition)
    // We look for credits to acc-fund-*
    const getFundBalance = (fundAccount: string) => {
        return ledger
            .filter(e => e.creditAccountId === fundAccount)
            .reduce((sum, e) => sum + e.amount, 0) - 
            ledger
            .filter(e => e.debitAccountId === fundAccount)
            .reduce((sum, e) => sum + e.amount, 0);
    };

    const funds = {
        national: getFundBalance('acc-fund-national'),
        unit: getFundBalance('acc-fund-unit'),
        welfare: getFundBalance('acc-fund-welfare'),
        development: getFundBalance('acc-fund-development'),
        projectSupport: getFundBalance('acc-fund-project'),
        commandRefreshment: getFundBalance('acc-fund-command'),
        donation: getFundBalance('acc-fund-donation'),
        openingSurplus: getFundBalance('acc-fund-opening-surplus')
    };

    const restrictedFundsTotal =
      funds.national +
      funds.unit +
      funds.welfare +
      funds.development +
      funds.projectSupport +
      funds.commandRefreshment +
      funds.donation;

    const netAssets = totalAssets - totalLiabilities;
    const accumulatedSurplus = netAssets - restrictedFundsTotal;

    const totalEquity = restrictedFundsTotal + accumulatedSurplus;

    return {
      assets: {
        cashAtBank,
        arrears,
        total: totalAssets
      },
      liabilities: {
        prepaidDues,
        unpaidExpenses,
        total: totalLiabilities
      },
      funds: {
        ...funds,
        accumulatedSurplus,
        total: totalEquity
      }
    };
  }, [members, ledger, expenses, duesConfig]);

  // Balance Check
  const isBalanced = Math.abs(financialData.assets.total - (financialData.liabilities.total + financialData.funds.total)) < 1;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 print:max-w-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">Statement of Financial Position</h2>
           <p className="text-slate-500 font-medium">Unit 48 Special Marshals Association • As of {new Date().toLocaleDateString()}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 self-start ${isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
           <span className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-emerald-500' : 'bg-rose-500'}`} />
           <span className="text-sm font-bold uppercase tracking-wider">{isBalanced ? 'Books Balanced' : 'Discrepancy Detected'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ASSETS SECTION */}
        <div className="space-y-6">
           <div className="flex items-center gap-3 border-b-2 border-indigo-100 pb-2">
               <h3 className="text-xl font-black text-indigo-900 uppercase tracking-widest">Assets</h3>
               <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-full">Resources</span>
           </div>
           
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <BalanceLine label="Cash & Bank Balances" amount={financialData.assets.cashAtBank} icon="🏦" />
              <BalanceLine label="Members' Arrears (Outstanding)" amount={financialData.assets.arrears} icon="📉" note="Receivables" />
              <BalanceLine label="Fixed Assets" amount={0} icon="🏢" note="None recorded" />
              <BalanceLine label="Prepaid Expenses" amount={0} icon="⏳" note="None recorded" />
           </div>

           <div className="bg-slate-800 p-6 rounded-2xl shadow-lg flex justify-between items-center text-white">
              <span className="font-black uppercase tracking-widest text-slate-400">Total Assets</span>
              <span className="font-mono font-black text-2xl">₦{financialData.assets.total.toLocaleString()}</span>
           </div>
        </div>

        {/* LIABILITIES & FUNDS SECTION */}
        <div className="space-y-8">
           {/* Liabilities */}
           <div className="space-y-6">
                <div className="flex items-center gap-3 border-b-2 border-orange-100 pb-2">
                    <h3 className="text-xl font-black text-orange-900 uppercase tracking-widest">Liabilities</h3>
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase rounded-full">Obligations</span>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                    <BalanceLine label="Dues Received in Advance" amount={financialData.liabilities.prepaidDues} icon="↩️" />
                    <BalanceLine label="Unpaid Obligations" amount={financialData.liabilities.unpaidExpenses} icon="🧾" />
                </div>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest text-orange-800 text-xs">Total Liabilities</span>
                    <span className="font-mono font-bold text-xl text-orange-900">₦{financialData.liabilities.total.toLocaleString()}</span>
                </div>
           </div>

           {/* Funds / Equity */}
           <div className="space-y-6">
                <div className="flex items-center gap-3 border-b-2 border-emerald-100 pb-2">
                    <h3 className="text-xl font-black text-emerald-900 uppercase tracking-widest">Funds & Equity</h3>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full">Net Assets</span>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Restricted & Designated Funds</h4>
                    
                    <FundLine label="National Due Fund" amount={financialData.funds.national} />
                    <FundLine label="Unit Due Fund" amount={financialData.funds.unit} />
                    <FundLine label="Welfare Fund" amount={financialData.funds.welfare} />
                    <FundLine label="Development Levy Fund" amount={financialData.funds.development} />
                    <FundLine label="Project Support Fund" amount={financialData.funds.projectSupport} />
                    <FundLine label="Command Refreshment Fund" amount={financialData.funds.commandRefreshment} />
                    <FundLine label="Donation Fund" amount={financialData.funds.donation} />

                    <div className="border-t border-slate-100 pt-4 mt-2">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-500">Accumulated Surplus / (Deficit)</span>
                            <span className={`font-mono font-bold ${financialData.funds.accumulatedSurplus >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                                ₦{financialData.funds.accumulatedSurplus.toLocaleString()}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                           Represents unallocated revenue minus total incurred expenses.
                        </p>
                    </div>
                </div>
                
                <div className="bg-slate-800 p-6 rounded-2xl shadow-lg flex justify-between items-center text-white">
                    <span className="font-black uppercase tracking-widest text-slate-400">Total Funds & Liab.</span>
                    <span className="font-mono font-black text-2xl">₦{(financialData.liabilities.total + financialData.funds.total).toLocaleString()}</span>
                </div>
           </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-sm text-slate-600 space-y-2">
          <h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest mb-2">Notes to the Financial Statements</h4>
          <p><strong className="text-slate-900">1. Accounting Basis:</strong> This Statement is prepared on an Accrual Basis. Revenue is recognized when assessments are levied, and expenses when incurred.</p>
          <p><strong className="text-slate-900">2. Arrears (Outstanding):</strong> Represents the total unpaid dues from members for current and past financial years, classified as Assets (Receivables).</p>
          <p><strong className="text-slate-900">3. Fund Allocation:</strong> Annual Assessments are allocated to National, Unit, Welfare, and Development funds based on the ratios defined in the Dues Configuration.</p>
          <p><strong className="text-slate-900">4. Restricted Funds:</strong> Donations, Project Support, and Command Refreshment are recognized only upon specific designation in ledger entries.</p>
      </div>
    </div>
  );
};

const BalanceLine = ({ label, amount, icon, note }: { label: string, amount: number, icon: string, note?: string }) => (
    <div className="flex justify-between items-center group">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-lg text-lg group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div>
                <span className="font-bold text-slate-600 block">{label}</span>
                {note && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{note}</span>}
            </div>
        </div>
        <span className="font-mono font-bold text-lg text-slate-800">₦{amount.toLocaleString()}</span>
    </div>
);

const FundLine = ({ label, amount }: { label: string, amount: number }) => (
    <div className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
        <span className="font-medium text-slate-600 text-sm">{label}</span>
        <span className="font-mono font-bold text-slate-700">₦{amount.toLocaleString()}</span>
    </div>
);

export default BalanceSheet;
