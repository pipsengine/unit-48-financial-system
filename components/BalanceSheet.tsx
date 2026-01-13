import React, { useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { Member, LedgerEntry, Expense, ExpenseStatus } from '../types';

const BalanceSheet: React.FC = () => {
  const members = StorageService.getMembers();
  const ledger = StorageService.getData<LedgerEntry>('ledger_entry');
  const expenses = StorageService.getData<Expense>('expense');

  const financialData = useMemo(() => {
    // 1. Assets
    // Cash at Bank: Total Payments Received - Total Expenses Paid
    // Note: We assume all verified payments go to bank and all paid expenses come from bank
    
    // Inflow: Debits to acc-bank (from Payments)
    const bankDebits = ledger
      .filter(e => e.debitAccountId === 'acc-bank')
      .reduce((sum, e) => sum + e.amount, 0);
      
    // Outflow: Expenses marked as PAID
    const paidExpenses = expenses
      .filter(e => e.status === ExpenseStatus.PAID)
      .reduce((sum, e) => sum + e.amount, 0);
      
    const cashAtBank = bankDebits - paidExpenses;

    // Accounts Receivable: Money owed by members (Sum of negative balances)
    // Note: In getMembers(), balance = Payments - Charges. 
    // So Negative Balance = Debt/Owed.
    const accountsReceivable = members
      .filter(m => m.balance < 0)
      .reduce((sum, m) => sum + Math.abs(m.balance), 0);

    const totalAssets = cashAtBank + accountsReceivable;

    // 2. Liabilities
    // Prepaid Dues: Money paid in advance by members (Sum of positive balances)
    const prepaidDues = members
      .filter(m => m.balance > 0)
      .reduce((sum, m) => sum + m.balance, 0);

    const totalLiabilities = prepaidDues;

    // 3. Equity
    // Retained Earnings = Revenue - Expenses
    // Revenue: Sum of all credits to Revenue Accounts
    const totalRevenue = ledger
      .filter(e => e.creditAccountId.startsWith('acc-revenue'))
      .reduce((sum, e) => sum + e.amount, 0);
      
    // Expenses: Using the same paidExpenses value
    // Note: If we had accrual expenses, we'd look at ledger, but currently expense module drives this
    const totalExpenses = paidExpenses;
    
    const netIncome = totalRevenue - totalExpenses;
    
    // Check for Opening Balance Equity if any
    const openingEquity = ledger
        .filter(e => e.postingType === 'OPENING_BALANCE' && e.creditAccountId.startsWith('acc-equity'))
        .reduce((sum, e) => sum + e.amount, 0);

    const totalEquity = netIncome + openingEquity;

    return {
      assets: {
        cashAtBank,
        accountsReceivable,
        total: totalAssets
      },
      liabilities: {
        prepaidDues,
        total: totalLiabilities
      },
      equity: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netIncome,
        openingEquity,
        total: totalEquity
      }
    };
  }, [members, ledger, expenses]);

  // Balance Check
  const isBalanced = Math.abs(financialData.assets.total - (financialData.liabilities.total + financialData.equity.total)) < 1;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">Statement of Financial Position</h2>
           <p className="text-slate-500 font-medium">Balance Sheet as of {new Date().toLocaleDateString()}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
           <span className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-emerald-500' : 'bg-rose-500'}`} />
           <span className="text-sm font-bold uppercase tracking-wider">{isBalanced ? 'Books Balanced' : 'Discrepancy Detected'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ASSETS */}
        <div className="space-y-6">
           <h3 className="text-xl font-black text-slate-700 uppercase tracking-widest border-b-2 border-slate-200 pb-2">Assets</h3>
           
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <span className="font-bold text-slate-600">Cash & Cash Equivalents</span>
                 </div>
                 <span className="font-mono font-bold text-lg text-slate-800">₦{financialData.assets.cashAtBank.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <span className="font-bold text-slate-600">Accounts Receivable</span>
                 </div>
                 <span className="font-mono font-bold text-lg text-slate-800">₦{financialData.assets.accountsReceivable.toLocaleString()}</span>
              </div>
           </div>

           <div className="bg-slate-800 p-6 rounded-2xl shadow-lg flex justify-between items-center text-white">
              <span className="font-black uppercase tracking-widest text-slate-400">Total Assets</span>
              <span className="font-mono font-black text-2xl">₦{financialData.assets.total.toLocaleString()}</span>
           </div>
        </div>

        {/* LIABILITIES & EQUITY */}
        <div className="space-y-8">
           {/* Liabilities */}
           <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-700 uppercase tracking-widest border-b-2 border-slate-200 pb-2">Liabilities</h3>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <span className="font-bold text-slate-600">Prepaid Dues</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-slate-800">₦{financialData.liabilities.prepaidDues.toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest text-slate-500 text-xs">Total Liabilities</span>
                    <span className="font-mono font-bold text-xl text-slate-700">₦{financialData.liabilities.total.toLocaleString()}</span>
                </div>
           </div>

           {/* Equity */}
           <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-700 uppercase tracking-widest border-b-2 border-slate-200 pb-2">Equity</h3>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            </div>
                            <span className="font-bold text-slate-600">Total Revenue</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-emerald-600">+ ₦{financialData.equity.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-lg text-red-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                            </div>
                            <span className="font-bold text-slate-600">Total Expenses</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-red-600">- ₦{financialData.equity.expenses.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                         <span className="font-bold text-slate-500">Net Income</span>
                         <span className={`font-mono font-bold text-lg ${financialData.equity.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            ₦{financialData.equity.netIncome.toLocaleString()}
                         </span>
                    </div>
                </div>
                
                <div className="bg-slate-800 p-6 rounded-2xl shadow-lg flex justify-between items-center text-white">
                    <span className="font-black uppercase tracking-widest text-slate-400">Total Equity & Liab.</span>
                    <span className="font-mono font-black text-2xl">₦{(financialData.liabilities.total + financialData.equity.total).toLocaleString()}</span>
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceSheet;
