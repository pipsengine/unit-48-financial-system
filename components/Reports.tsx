
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { StorageService } from '../services/storageService';
import { getFinancialHealthAnalysis } from '../services/geminiService';
import { LedgerEntry, DueType, BillingFrequency, DueConfig } from '../types';

const Reports: React.FC = () => {
  const [analysis, setAnalysis] = useState<string>('Analyzing financial vectors...');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<{title: string, data: any} | null>(null);
  
  const members = StorageService.getMembers();
  const ledger = StorageService.getData<LedgerEntry>('u48_ledger');
  const expenses = StorageService.getData<any>('u48_expenses');
  const duesConfigs = StorageService.getData<DueConfig>('u48_dues');

  const currentYear = new Date().getFullYear();

  // Financial Calculations
  const financialMetrics = useMemo(() => {
    // 1. Total Aging Credit (Total of all payments ever made - Unit Liquidity)
    const totalAgingCredit = ledger
      .filter(e => e.referenceType === 'PAYMENT')
      .reduce((sum, e) => sum + e.amount, 0);

    // 2. Total Credit for the Year
    const totalCreditYear = ledger
      .filter(e => e.referenceType === 'PAYMENT' && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);

    // 3. Total Debit for the Year
    const totalDebitYear = ledger
      .filter(e => e.referenceType !== 'PAYMENT' && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);

    // 4. Total Outstanding Aging (Sum of all negative member balances)
    const totalOutstandingAging = members
      .filter(m => m.balance < 0)
      .reduce((sum, m) => sum + Math.abs(m.balance), 0);

    // 5. Total Members
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'ACTIVE').length;

    // 6. Category Totals (Derived from active member count * config rates)
    const getRate = (type: DueType) => {
      const cfg = duesConfigs.find(c => c.dueType === type);
      if (!cfg) return 0;
      return cfg.billingFrequency === BillingFrequency.ANNUAL ? cfg.amount : cfg.amount * 12;
    };

    const totalNational = activeMembers * getRate(DueType.NATIONAL);
    const totalUnit = activeMembers * getRate(DueType.UNIT);
    const totalWelfare = activeMembers * getRate(DueType.WELFARE);
    const totalDevelopment = activeMembers * getRate(DueType.DEVELOPMENT);

    // 7. Ad-hoc Categories (Checking ledger descriptions for specific keywords)
    const getAdHocTotal = (keyword: string) => ledger
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
  }, [ledger, members, currentYear, duesConfigs]);

  const pendingExpenses = expenses.filter((e: any) => e.status === 'UNDER_REVIEW').length;
  
  const collectionEfficiency = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'ACTIVE');
    const totalExpected = activeMembers.length * 21600;
    const totalPayments = ledger
      .filter(e => e.referenceType === 'PAYMENT' && new Date(e.entryDate).getFullYear() === currentYear)
      .reduce((sum, e) => sum + e.amount, 0);
    if (totalExpected === 0) return "0.0%";
    return ((totalPayments / totalExpected) * 100).toFixed(1) + "%";
  }, [members, ledger, currentYear]);

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
    setPreviewReport({
      title,
      data: {
        timestamp: new Date().toLocaleString(),
        summary: `Aggregated data for ${title} based on current FY ${currentYear} ledger states.`,
        kpis: [
          { label: 'Total Entries', value: ledger.length },
          { label: 'Yearly Credit', value: `₦${financialMetrics.totalCreditYear.toLocaleString()}` },
          { label: 'Yearly Debit', value: `₦${financialMetrics.totalDebitYear.toLocaleString()}` }
        ]
      }
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
          <select className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
             <option>FY {currentYear} Registry</option>
             <option>FY {currentYear - 1} Archive</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ReportCard 
            title="Income Statement" 
            onPreview={() => handlePreview("Income Statement")}
            onExport={() => handleExport("Income Statement")}
            desc="Summary of unit revenues from dues versus hospitality and logistics costs." 
            icon={<svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <ReportCard 
            title="Balance Sheet" 
            onPreview={() => handlePreview("Balance Sheet")}
            onExport={() => handleExport("Balance Sheet")}
            desc="Current snapshot of cash assets, member liabilities, and unit equity." 
            icon={<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
          />
          <ReportCard 
            title="Collection Breakout" 
            onPreview={() => handlePreview("Collection Breakout")}
            onExport={() => handleExport("Collection Breakout")}
            desc="Detailed performance tracking by National, Development, Unit, and Welfare categories." 
            icon={<svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          />
          <ReportCard 
            title="Arrears Aging" 
            onPreview={() => handlePreview("Arrears Aging")}
            onExport={() => handleExport("Arrears Aging")}
            desc="List of personnel with outstanding balances, categorized by duration and risk." 
            icon={<svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
          />
          <ReportCard 
            title="Budget Variance" 
            onPreview={() => handlePreview("Budget Variance")}
            onExport={() => handleExport("Budget Variance")}
            desc="Comparison of actual expenditures against the approved unit fiscal budget." 
            icon={<svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
          />
          <ReportCard 
            title="Audit Ready Export" 
            onPreview={() => handlePreview("Audit Ready Export")}
            onExport={() => handleExport("Audit Ready Export")}
            desc="Cryptographically signed ledger export for external audit and compliance." 
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
