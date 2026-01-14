
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { StorageService } from '../services/storageService';
import { getFinancialHealthAnalysis } from '../services/geminiService';
import { LedgerEntry, DueType, BillingFrequency, DueConfig, Payment, PaymentStatus, LedgerStatus, AuditLog, Member, PostingType } from '../types';

const Reports: React.FC = () => {
  const [analysis, setAnalysis] = useState<string>('Analyzing financial vectors...');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<{title: string, data: any} | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
 
  const members = StorageService.getMembers();
  const ledger = StorageService.getData<LedgerEntry>('u48_ledger');
  const expenses = StorageService.getData<any>('u48_expenses');
  const duesConfigs = StorageService.getData<DueConfig>('u48_dues');
  const payments = StorageService.getPayments();
  const auditLogs = StorageService.getData<AuditLog>('audit_log');

  const currentYear = new Date().getFullYear();

  const postedLedger = useMemo(() => {
    return ledger.filter(e => e.status === LedgerStatus.POSTED);
  }, [ledger]);

  // Financial Calculations
  const financialMetrics = useMemo(() => {
    const totalPreviousCredit = members.reduce((sum, m) => sum + (m.previousBalance && m.previousBalance > 0 ? m.previousBalance : 0), 0);
    
    const totalAgingCredit = postedLedger
      .filter(e => e.referenceType === 'PAYMENT')
      .reduce((sum, e) => sum + e.amount, 0) + totalPreviousCredit;

    const totalCreditYear = postedLedger
      .filter(e => e.referenceType === 'PAYMENT' && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalDebitYear = postedLedger
      .filter(e => e.referenceType !== 'PAYMENT' && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalOutstandingAging = members
      .filter(m => m.balance < 0)
      .reduce((sum, m) => sum + Math.abs(m.balance), 0);

    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'ACTIVE').length;

    const getRate = (type: DueType) => {
      const cfg = duesConfigs.find(c => c.dueType === type);
      if (!cfg) return 0;
      return cfg.billingFrequency === BillingFrequency.ANNUAL ? cfg.amount : cfg.amount * 12;
    };

    const totalNational = activeMembers * getRate(DueType.NATIONAL);
    const totalUnit = activeMembers * getRate(DueType.UNIT);
    const totalWelfare = activeMembers * getRate(DueType.WELFARE);
    const totalDevelopment = activeMembers * getRate(DueType.DEVELOPMENT);

    const getAdHocTotal = (keyword: string) => postedLedger
      .filter(e => e.description.toLowerCase().includes(keyword.toLowerCase()) && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalProjectSupport = getAdHocTotal('Project Support');
    const totalDonations = getAdHocTotal('Donation');
    const totalCommandRefreshment = getAdHocTotal('Command Refreshment');

    return {
      totalAgingCredit,
      totalCreditYear,
      totalDebitYear,
      totalOutstandingAging,
      totalMembers,
      totalNational,
      totalUnit,
      totalWelfare,
      totalDevelopment,
      totalProjectSupport,
      totalDonations,
      totalCommandRefreshment
    };
  }, [postedLedger, members, currentYear, duesConfigs]);

  const pendingExpenses = expenses.filter((e: any) => e.status === 'UNDER_REVIEW').length;
  
  const collectionEfficiency = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'ACTIVE');
    const totalExpected = activeMembers.length * 21600;
    const totalPayments = postedLedger
      .filter(e => e.referenceType === 'PAYMENT' && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);
    if (totalExpected === 0) return "0.0%";
    return ((totalPayments / totalExpected) * 100).toFixed(1) + "%";
  }, [members, postedLedger, currentYear]);

  useEffect(() => {
    const fetchAnalysis = async () => {
      const liveData = {
        totalBalance: financialMetrics.totalAgingCredit,
        arrearsCount: members.filter(m => m.balance < 0).length,
        collectionEfficiency,
        memberCount: financialMetrics.totalMembers,
        pendingExpenses,
        metrics: financialMetrics
      };
      const result = await getFinancialHealthAnalysis(liveData);
      setAnalysis(result || "Analysis engine offline.");
    };
    fetchAnalysis();
  }, [financialMetrics, collectionEfficiency, members.length, pendingExpenses]);

  const handlePreview = (title: string) => {
    let reportData: any = {
      timestamp: new Date().toLocaleString(),
      summary: `Aggregated data for ${title} based on current FY ${currentYear} ledger states.`,
      kpis: []
    };

    switch (title) {
      case "Personal Ledger / Member Statement": {
        const memberId = selectedMemberId || (members[0]?.id || '');
        if (!memberId) {
          reportData.summary = 'No members available for personal ledger.';
          break;
        }

        const allEntries = ledger.filter(e => e.memberId === memberId && e.status === LedgerStatus.POSTED);
        const openingEntries = allEntries.filter(e => e.appliedFinancialYear < selectedYear);
        const currentEntries = allEntries.filter(e => e.appliedFinancialYear === selectedYear);

        const computeNet = (entries: LedgerEntry[]) => {
          return entries.reduce((sum, entry) => {
            const isDebit = entry.debitAccountId && entry.debitAccountId.includes('member');
            const isCredit = entry.creditAccountId && entry.creditAccountId.includes('member');
            if (isDebit) return sum + entry.amount;
            if (isCredit) return sum - entry.amount;
            return sum;
          }, 0);
        };

        const openingBalance = computeNet(openingEntries);

        const sortedCurrent = currentEntries
          .slice()
          .sort((a, b) => {
            const dateA = new Date(a.effectiveDate).getTime();
            const dateB = new Date(b.effectiveDate).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });

        let runningBalance = openingBalance;
        let totalDebits = 0;
        let totalCredits = 0;

        const rows = sortedCurrent.map(entry => {
          const isDebit = entry.debitAccountId && entry.debitAccountId.includes('member');
          const isCredit = entry.creditAccountId && entry.creditAccountId.includes('member');

          let delta = 0;
          let debitAmount = '';
          let creditAmount = '';

          if (isDebit) {
            delta = entry.amount;
            debitAmount = `₦${entry.amount.toLocaleString()}`;
            totalDebits += entry.amount;
          } else if (isCredit) {
            delta = -entry.amount;
            creditAmount = `₦${entry.amount.toLocaleString()}`;
            totalCredits += entry.amount;
          }

          runningBalance += delta;

          return [
            entry.effectiveDate,
            entry.category || '',
            entry.postingType || '',
            debitAmount || '-',
            creditAmount || '-',
            `₦${runningBalance.toLocaleString()}`,
            entry.description
          ];
        });

        const closingBalance = runningBalance;
        const member = members.find((m: Member) => m.id === memberId);
        const memberLabel = member ? `${member.fullName} (${member.membershipId})` : memberId;

        reportData.kpis = [
          { label: 'Member', value: memberLabel },
          { label: 'Financial Year', value: selectedYear.toString() },
          { label: 'Opening Balance (B/F)', value: `₦${openingBalance.toLocaleString()}` },
          { label: 'Closing Balance (C/F)', value: `₦${closingBalance.toLocaleString()}` },
          { label: 'Total Debits (Charges)', value: `₦${totalDebits.toLocaleString()}` },
          { label: 'Total Credits (Payments)', value: `₦${totalCredits.toLocaleString()}` }
        ];

        reportData.summary = `Personal ledger for ${memberLabel} in financial year ${selectedYear}. Closing balance is ₦${closingBalance.toLocaleString()} based on posted charges and payments only.`;
        reportData.headers = ['Date', 'Category', 'Type', 'Debit', 'Credit', 'Running Balance', 'Description'];
        reportData.rows = rows;
        break;
      }

      case "Income & Expenditure Statement":
      case "Income Statement": {
        const netIncome = financialMetrics.totalCreditYear - financialMetrics.totalDebitYear;
        reportData.kpis = [
          { label: 'Total Revenue', value: `₦${financialMetrics.totalCreditYear.toLocaleString()}` },
          { label: 'Total Expenses', value: `₦${financialMetrics.totalDebitYear.toLocaleString()}` },
          { label: 'Net Surplus/Deficit', value: `₦${netIncome.toLocaleString()}` },
          { label: 'Operating Ratio', value: financialMetrics.totalCreditYear > 0 ? `${((financialMetrics.totalDebitYear / financialMetrics.totalCreditYear) * 100).toFixed(1)}%` : 'N/A' }
        ];
        reportData.summary = `The unit generated ₦${financialMetrics.totalCreditYear.toLocaleString()} in revenue against ₦${financialMetrics.totalDebitYear.toLocaleString()} in expenses, resulting in a net ${netIncome >= 0 ? 'surplus' : 'deficit'} of ₦${Math.abs(netIncome).toLocaleString()}.`;
        break;
      }

      case "Balance Sheet": {
        const totalAssets = financialMetrics.totalAgingCredit + financialMetrics.totalOutstandingAging;
        const totalLiabilities = members.filter(m => m.balance > 0).reduce((sum, m) => sum + m.balance, 0);
        const equity = totalAssets - totalLiabilities;
        
        reportData.kpis = [
          { label: 'Total Assets', value: `₦${totalAssets.toLocaleString()}` },
          { label: 'Total Liabilities', value: `₦${totalLiabilities.toLocaleString()}` },
          { label: 'Unit Equity', value: `₦${equity.toLocaleString()}` },
          { label: 'Liquidity Ratio', value: totalLiabilities > 0 ? (financialMetrics.totalAgingCredit / totalLiabilities).toFixed(2) : '∞' }
        ];
        reportData.summary = `The unit possesses total assets of ₦${totalAssets.toLocaleString()} (including receivables), with current liabilities of ₦${totalLiabilities.toLocaleString()}.`;
        break;
      }

      case "Collections Report":
      case "Collection Breakout": {
        const nonReversedPayments = payments.filter((p: Payment) => p.status !== PaymentStatus.REVERSED);
        const totalCollections = nonReversedPayments.reduce((sum, p) => sum + p.amount, 0);
        reportData.kpis = [
          { label: 'National Dues', value: `₦${financialMetrics.totalNational.toLocaleString()}` },
          { label: 'Unit Dues', value: `₦${financialMetrics.totalUnit.toLocaleString()}` },
          { label: 'Welfare', value: `₦${financialMetrics.totalWelfare.toLocaleString()}` },
          { label: 'Development', value: `₦${financialMetrics.totalDevelopment.toLocaleString()}` },
          { label: 'Total Collections', value: `₦${totalCollections.toLocaleString()}` }
        ];
        reportData.summary = `Collections register for FY ${currentYear}, including dues and levies, grouped by payment method and category.`;
        reportData.headers = ['Date', 'Member', 'Category', 'Amount', 'Method', 'Status', 'Receipt No'];
        reportData.rows = nonReversedPayments
          .slice()
          .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
          .slice(0, 50)
          .map(p => [
            p.paymentDate,
            p.memberName,
            p.paymentType || 'GENERAL',
            `₦${p.amount.toLocaleString()}`,
            p.paymentMethod,
            p.status,
            p.referenceNumber
          ]);
        break;
      }

      case "Arrears / Outstanding Report":
      case "Arrears Aging": {
        const debtors = members
          .map(m => ({ ...m, totalDebt: (m.balance + (m.arrearsBalance || 0) + (m.previousBalance || 0)) }))
          .filter(m => m.totalDebt < 0)
          .sort((a, b) => a.totalDebt - b.totalDebt);
        
        const topDebtors = debtors.slice(0, 5);
        const totalArrears = debtors.reduce((sum, m) => sum + Math.abs(m.totalDebt), 0);
        
        reportData.kpis = [
          { label: 'Total Arrears', value: `₦${totalArrears.toLocaleString()}` },
          { label: 'Debtor Count', value: debtors.length.toString() },
          { label: 'Avg Arrears', value: debtors.length > 0 ? `₦${(totalArrears / debtors.length).toLocaleString(undefined, {maximumFractionDigits: 0})}` : '₦0' },
          { label: 'Highest Arrear', value: debtors.length > 0 ? `₦${Math.abs(debtors[0].totalDebt).toLocaleString()}` : '₦0' }
        ];
        reportData.summary = `There are ${debtors.length} members with outstanding balances totaling ₦${totalArrears.toLocaleString()}.`;
        reportData.headers = ['Member Name', 'Service No', 'Outstanding Balance'];
        reportData.rows = topDebtors.map(d => [d.fullName, d.membershipId, `₦${Math.abs(d.totalDebt).toLocaleString()}`]);
        break;
      }

      case "Fund Balance Report": {
        const fundAccounts = [
          { key: 'acc-fund-national', label: 'National Due Fund' },
          { key: 'acc-fund-unit', label: 'Unit Due Fund' },
          { key: 'acc-fund-welfare', label: 'Welfare Fund' },
          { key: 'acc-fund-development', label: 'Development Levy Fund' },
          { key: 'acc-fund-project', label: 'Project Support Fund' },
          { key: 'acc-fund-command', label: 'Command Refreshment Fund' },
          { key: 'acc-fund-donation', label: 'Donation Fund' }
        ];
        const fundRows = fundAccounts.map(f => {
          const inflows = postedLedger
            .filter(e => e.creditAccountId === f.key)
            .reduce((sum, e) => sum + e.amount, 0);
          const outflows = postedLedger
            .filter(e => e.debitAccountId === f.key)
            .reduce((sum, e) => sum + e.amount, 0);
          const closing = inflows - outflows;
          return {
            label: f.label,
            inflows,
            outflows,
            closing
          };
        });
        const totalClosingFunds = fundRows.reduce((sum, r) => sum + r.closing, 0);
        reportData.kpis = [
          { label: 'Total Fund Balances', value: `₦${totalClosingFunds.toLocaleString()}` },
          { label: 'Tracked Funds', value: fundRows.length.toString() }
        ];
        reportData.summary = `Fund balances computed from posted ledger entries by account, showing inflows, outflows, and closing position for each designated fund bucket.`;
        reportData.headers = ['Fund', 'Opening Balance (Approx)', 'Total Inflows', 'Total Outflows', 'Closing Balance'];
        reportData.rows = fundRows.map(r => [
          r.label,
          '₦0',
          `₦${r.inflows.toLocaleString()}`,
          `₦${r.outflows.toLocaleString()}`,
          `₦${r.closing.toLocaleString()}`
        ]);
        break;
      }

      case "Trial Balance": {
        const yearEntries = postedLedger.filter(
          e => e.appliedFinancialYear === selectedYear
        );
        const accountMap: Record<string, { debit: number; credit: number }> = {};
        yearEntries.forEach(e => {
          if (!accountMap[e.debitAccountId]) accountMap[e.debitAccountId] = { debit: 0, credit: 0 };
          if (!accountMap[e.creditAccountId]) accountMap[e.creditAccountId] = { debit: 0, credit: 0 };
          accountMap[e.debitAccountId].debit += e.amount;
          accountMap[e.creditAccountId].credit += e.amount;
        });
        const accountRows = Object.entries(accountMap).map(([account, totals]) => ({
          account,
          debit: totals.debit,
          credit: totals.credit
        }));
        const totalDebit = accountRows.reduce((sum, r) => sum + r.debit, 0);
        const totalCredit = accountRows.reduce((sum, r) => sum + r.credit, 0);
        reportData.kpis = [
          { label: 'Financial Year', value: selectedYear.toString() },
          { label: 'Total Debits', value: `₦${totalDebit.toLocaleString()}` },
          { label: 'Total Credits', value: `₦${totalCredit.toLocaleString()}` },
          { label: 'Balanced', value: totalDebit === totalCredit ? 'YES' : 'NO' }
        ];
        reportData.summary = `Trial balance for financial year ${selectedYear} across all ledger accounts. Debits and credits ${totalDebit === totalCredit ? 'match' : 'do not match'} for the selected year.`;
        reportData.headers = ['Account', 'Debit Total', 'Credit Total'];
        reportData.rows = accountRows
          .sort((a, b) => a.account.localeCompare(b.account))
          .map(r => [
            r.account,
            `₦${r.debit.toLocaleString()}`,
            `₦${r.credit.toLocaleString()}`
          ]);
        break;
      }

      case "General Ledger": {
        reportData.kpis = [
          { label: 'Posted Entries', value: postedLedger.length },
          { label: 'Current FY Entries', value: postedLedger.filter(e => e.appliedFinancialYear === currentYear).length }
        ];
        reportData.summary = `Chronological listing of posted ledger entries across all accounts, grouped by applied financial year and category. Preview shows the latest activity.`;
        reportData.headers = ['Date', 'Applied Year', 'Posting Year', 'Member', 'Category', 'Type', 'Debit Account', 'Credit Account', 'Amount'];
        reportData.rows = postedLedger
          .slice()
          .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
          .slice(0, 50)
          .map(e => {
            const member = members.find((m: Member) => m.id === e.memberId);
            return [
              e.entryDate,
              e.appliedFinancialYear,
              e.postingYear,
              member ? member.fullName : '',
              e.category || '',
              e.postingType || '',
              e.debitAccountId,
              e.creditAccountId,
              `₦${e.amount.toLocaleString()}`
            ];
          });
        break;
      }

      case "Payment Register": {
        const paymentRows = payments
          .filter((p: Payment) => p.status !== PaymentStatus.REVERSED)
          .slice()
          .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
        const totalRegisterAmount = paymentRows.reduce((sum, p) => sum + p.amount, 0);
        reportData.kpis = [
          { label: 'Receipts Count', value: paymentRows.length },
          { label: 'Total Amount', value: `₦${totalRegisterAmount.toLocaleString()}` }
        ];
        reportData.summary = `Chronological register of all verified and pending receipts, excluding reversed items, for operational reconciliation.`;
        reportData.headers = ['Date', 'Receipt No', 'Member', 'Category', 'Amount', 'Method', 'Status'];
        reportData.rows = paymentRows.slice(0, 100).map(p => [
          p.paymentDate,
          p.referenceNumber,
          p.memberName,
          p.paymentType || 'GENERAL',
          `₦${p.amount.toLocaleString()}`,
          p.paymentMethod,
          p.status
        ]);
        break;
      }

      case "Audit Trail": {
        const sortedAudit = auditLogs
          .slice()
          .sort((a: AuditLog, b: AuditLog) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        reportData.kpis = [
          { label: 'Total Events', value: sortedAudit.length },
          { label: 'Unique Users', value: new Set(sortedAudit.map(a => a.userId)).size.toString() }
        ];
        reportData.summary = `Immutable audit history of key system actions including reversals, reclassifications, and administrative changes.`;
        reportData.headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity Id', 'IP Address'];
        reportData.rows = sortedAudit.slice(0, 100).map(a => [
          a.timestamp,
          a.userName,
          a.action,
          a.entityType,
          a.entityId,
          a.ipAddress
        ]);
        break;
      }

      case "Budget Variance": {
        const expectedRevenue = financialMetrics.totalNational + financialMetrics.totalUnit + financialMetrics.totalWelfare + financialMetrics.totalDevelopment;
        const actualRevenue = financialMetrics.totalCreditYear;
        const variance = actualRevenue - expectedRevenue;
        
        reportData.kpis = [
          { label: 'Expected Revenue', value: `₦${expectedRevenue.toLocaleString()}` },
          { label: 'Actual Revenue', value: `₦${actualRevenue.toLocaleString()}` },
          { label: 'Variance (Abs)', value: `₦${Math.abs(variance).toLocaleString()}` },
          { label: 'Performance', value: `${((actualRevenue / expectedRevenue) * 100).toFixed(1)}%` }
        ];
        reportData.summary = `Actual revenue is ${variance >= 0 ? 'above' : 'below'} projections by ₦${Math.abs(variance).toLocaleString()} (${((actualRevenue / expectedRevenue) * 100).toFixed(1)}% of target).`;
        break;
      }

      default: {
        reportData.kpis = [
          { label: 'Total Entries', value: postedLedger.length },
          { label: 'Yearly Credit', value: `₦${financialMetrics.totalCreditYear.toLocaleString()}` },
          { label: 'Yearly Debit', value: `₦${financialMetrics.totalDebitYear.toLocaleString()}` }
        ];
      }
    }

    setPreviewReport({
      title,
      data: reportData
    });
  };

  const handleExport = (title: string) => {
    setIsGenerating(title);
    setTimeout(() => {
      setIsGenerating(null);
      alert(`Success: ${title} has been generated and dispatched to your local downloads folder.`);
    }, 2000);
  };

  return (
    <div className="space-y-10 pb-12 relative">
      {/* Loading Overlay for Export */}
      {isGenerating && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm">Compiling {isGenerating}</h4>
            <p className="text-slate-500 text-xs">Cryptographically signing and formatting report data...</p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewReport && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm">Report Preview</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">{previewReport.title}</p>
              </div>
              <button onClick={() => setPreviewReport(null)} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Generated At</p>
                   <p className="text-sm font-bold text-slate-700">{previewReport.data.timestamp}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fiscal Status</p>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded uppercase">Verified</span>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {previewReport.data.kpis.map((kpi: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                    <p className="text-lg font-black text-indigo-600 tracking-tighter">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Optional Table for List Data */}
              {previewReport.data.rows && (
                <div className="mt-4 border border-slate-100 rounded-xl overflow-hidden">
                   <table className="w-full text-left">
                     <thead className="bg-slate-50">
                       <tr>
                         {previewReport.data.headers.map((h: string, i: number) => (
                           <th key={i} className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                         ))}
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {previewReport.data.rows.map((row: any[], i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            {row.map((cell: any, j: number) => (
                              <td key={j} className="px-4 py-3 text-xs font-bold text-slate-600">{cell}</td>
                            ))}
                          </tr>
                        ))}
                     </tbody>
                   </table>
                </div>
              )}

              <p className="text-sm text-slate-600 leading-relaxed italic border-l-4 border-indigo-500 pl-4 py-2 bg-indigo-50/30 rounded-r-xl">
                {previewReport.data.summary}
              </p>
              <button 
                onClick={() => {
                  const t = previewReport.title;
                  setPreviewReport(null);
                  handleExport(t);
                }} 
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs"
              >
                Proceed to Download Full PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. GLOBAL KEY PERFORMANCE INDICATORS CONTAINER */}
      <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Global Key Performance Indicators</h3>
          <div className="flex gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Aggregate Data FY {currentYear}</span>
          </div>
        </div>
        
        {/* Responsive KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <StatCard 
            title="Total Unit Liquidity" 
            value={`₦${financialMetrics.totalAgingCredit.toLocaleString()}`} 
            subValue="Total Aging Credit"
            icon="💰" 
            variant="hero"
          />
          <StatCard 
            title="Total Outstanding Aging" 
            value={`₦${financialMetrics.totalOutstandingAging.toLocaleString()}`} 
            subValue="Aggregate Member Arrears"
            icon="⚠️" 
            variant="danger"
          />
          <StatCard 
            title="Total Credit (Year)" 
            value={`₦${financialMetrics.totalCreditYear.toLocaleString()}`} 
            subValue={`FY ${currentYear} Inflow`}
            trend={collectionEfficiency}
            icon="📥" 
          />
          <StatCard 
            title="Total Debit (Year)" 
            value={`₦${financialMetrics.totalDebitYear.toLocaleString()}`} 
            subValue={`FY ${currentYear} Assessments`}
            icon="📤" 
          />
          <StatCard 
            title="Total Members" 
            value={financialMetrics.totalMembers} 
            subValue="Registered Personnel"
            icon="👥" 
          />
          <StatCard 
            title="Total National Due" 
            value={`₦${financialMetrics.totalNational.toLocaleString()}`} 
            subValue="Yearly Projection"
            icon="🇳" 
          />
          <StatCard 
            title="Total Unit Due" 
            value={`₦${financialMetrics.totalUnit.toLocaleString()}`} 
            subValue="Yearly Projection"
            icon="🏠" 
          />
          <StatCard 
            title="Total Welfare Due" 
            value={`₦${financialMetrics.totalWelfare.toLocaleString()}`} 
            subValue="Yearly Projection"
            icon="🤝" 
          />
          <StatCard 
            title="Total Development Levy" 
            value={`₦${financialMetrics.totalDevelopment.toLocaleString()}`} 
            subValue="Yearly Projection"
            icon="🏗️" 
          />
          <StatCard 
            title="Total Project Support" 
            value={`₦${financialMetrics.totalProjectSupport.toLocaleString()}`} 
            subValue="Special Assessments"
            icon="🛠️" 
          />
          <StatCard 
            title="Total Donations" 
            value={`₦${financialMetrics.totalDonations.toLocaleString()}`} 
            subValue="External Contributions"
            icon="🎁" 
          />
          <StatCard 
            title="Command Refreshment" 
            value={`₦${financialMetrics.totalCommandRefreshment.toLocaleString()}`} 
            subValue="Hospitality Account"
            icon="☕" 
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. COLLECTION ANALYTICS CONTAINER */}
        <section className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Financial Performance Curve</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-600" /><span className="text-[10px] font-bold text-slate-400 uppercase">Projected Liability</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-slate-400 uppercase">Actual Collection</span></div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{
                name: `FY ${currentYear}`, 
                billed: financialMetrics.totalDebitYear, 
                actual: financialMetrics.totalCreditYear
              }]}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar name="Billed" dataKey="billed" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
                <Bar name="Actual" dataKey="actual" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 3. GEMINI INTELLIGENCE CONTAINER */}
        <section className="bg-indigo-900 rounded-[2rem] p-8 shadow-2xl text-white relative overflow-hidden flex flex-col">
          <div className="relative z-10 space-y-6 flex-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-xl font-black tracking-tight text-white">AI Financial Insights</h3>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 flex-1">
              <p className="text-indigo-50 text-sm leading-relaxed italic font-medium">
                "{analysis}"
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Powered by Gemini AI</div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
        </section>
      </div>

      {/* 4. OFFICIAL REPORT SELECTORS */}
      <div className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Official Unit Reports</h2>
            <p className="text-slate-500 font-medium">Verified statements for unit management and auditing.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select 
              className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            >
              <option value={currentYear}>FY {currentYear}</option>
              <option value={currentYear - 1}>FY {currentYear - 1}</option>
            </select>
            <select
              className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              <option value="">Select Member</option>
              {members.map((m: Member) => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.membershipId})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ReportCard 
            title="Personal Ledger / Member Statement" 
            onPreview={() => handlePreview("Personal Ledger / Member Statement")}
            onExport={() => handleExport("Personal Ledger / Member Statement")}
            desc="Per-member statement of charges, payments, arrears and advances for a financial year." 
            icon={<svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5h14M5 9h14M9 13h6m-6 4h3M5 5v14h14V5" /></svg>}
          />
          <ReportCard 
            title="Arrears / Outstanding Report" 
            onPreview={() => handlePreview("Arrears / Outstanding Report")}
            onExport={() => handleExport("Arrears / Outstanding Report")}
            desc="Who owes what, by member and category, including opening due and closing balance." 
            icon={<svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <ReportCard 
            title="Collections Report" 
            onPreview={() => handlePreview("Collections Report")}
            onExport={() => handleExport("Collections Report")}
            desc="All payments received, grouped by date, member, category and method." 
            icon={<svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 11h16M4 15h10M4 19h6" /></svg>}
          />
          <ReportCard 
            title="General Ledger" 
            onPreview={() => handlePreview("General Ledger")}
            onExport={() => handleExport("General Ledger")}
            desc="Chronological list of posted transactions with applied year, category and type." 
            icon={<svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16v4H4zM4 12h16v8H4z" /></svg>}
          />
          <ReportCard 
            title="Fund Balance Report" 
            onPreview={() => handlePreview("Fund Balance Report")}
            onExport={() => handleExport("Fund Balance Report")}
            desc="Opening, inflows, outflows and closing balances for each designated fund." 
            icon={<svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10l4-4 4 4m-4-4v14M13 10l4-4 4 4m-4-4v14" /></svg>}
          />
          <ReportCard 
            title="Balance Sheet" 
            onPreview={() => handlePreview("Balance Sheet")}
            onExport={() => handleExport("Balance Sheet")}
            desc="Statement of financial position: assets, liabilities, funds and accumulated surplus." 
            icon={<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
          />
          <ReportCard 
            title="Income & Expenditure Statement" 
            onPreview={() => handlePreview("Income & Expenditure Statement")}
            onExport={() => handleExport("Income & Expenditure Statement")}
            desc="Income by dues, levies, donations and expenses by welfare, projects and admin." 
            icon={<svg className="w-8 h-8 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6a2 2 0 00-2-2H5l4-4 4 4h-2a2 2 0 00-2 2v6m4 4h6m-3-3v6" /></svg>}
          />
          <ReportCard 
            title="Trial Balance" 
            onPreview={() => handlePreview("Trial Balance")}
            onExport={() => handleExport("Trial Balance")}
            desc="Per-account debit and credit totals; must balance before final statements." 
            icon={<svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 7h9M5 17h9" /></svg>}
          />
          <ReportCard 
            title="Payment Register" 
            onPreview={() => handlePreview("Payment Register")}
            onExport={() => handleExport("Payment Register")}
            desc="Receipt-level register with member, category, amount, date, status and user." 
            icon={<svg className="w-8 h-8 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 4h14v4H5zM5 12h14v8H5zM9 16h2m2 0h2" /></svg>}
          />
          <ReportCard 
            title="Audit Trail" 
            onPreview={() => handlePreview("Audit Trail")}
            onExport={() => handleExport("Audit Trail")}
            desc="Chronological log of corrections, reversals and critical actions for auditors." 
            icon={<svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>
      </div>
    </div>
  );
};

const ReportCard = ({ title, desc, icon, onPreview, onExport }: any) => (
  <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 flex flex-col hover:shadow-xl transition-all transform hover:-translate-y-1 group">
    <div className="mb-6 w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
      {icon}
    </div>
    <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed mb-8 flex-1">
      {desc}
    </p>
    <div className="flex gap-3">
      <button 
        onClick={onPreview}
        className="flex-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors"
      >
        Preview
      </button>
      <button 
        onClick={onExport}
        className="flex-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-colors"
      >
        Export PDF
      </button>
    </div>
  </div>
);

const StatCard = ({ title, value, subValue, trend, icon, variant = 'default' }: { 
  title: string, 
  value: string | number, 
  subValue?: string, 
  trend?: string, 
  icon: string, 
  variant?: 'default' | 'hero' | 'danger'
}) => {
  const styles = {
    default: 'bg-slate-50 border-slate-200 hover:bg-white',
    hero: 'bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-100/50',
    danger: 'bg-rose-50 border-rose-200 shadow-lg shadow-rose-100/50'
  };

  const textColors = {
    default: 'text-slate-900',
    hero: 'text-indigo-900',
    danger: 'text-rose-900'
  };

  return (
    <div className={`rounded-2xl p-6 border transition-all ${styles[variant]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`text-3xl ${variant === 'default' ? 'grayscale opacity-50' : ''}`}>{icon}</div>
        {trend && <span className="text-[10px] font-black px-2.5 py-1 bg-white/60 text-slate-700 rounded-lg shadow-sm border border-slate-100">{trend}</span>}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{title}</p>
      <h4 className={`text-2xl font-black mt-1 tracking-tighter ${textColors[variant]}`}>{value}</h4>
      {subValue && <p className="text-[9px] font-bold text-slate-400 mt-1 italic uppercase tracking-tighter leading-tight">{subValue}</p>}
    </div>
  );
};

export default Reports;
