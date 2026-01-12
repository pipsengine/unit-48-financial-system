
import React, { useState } from 'react';
import { StorageService } from '../services/storageService';
import { DueConfig, DueType, BillingFrequency } from '../types';

interface DuesConfigProps { refreshDB: () => void; }

const DuesConfigComponent: React.FC<DuesConfigProps> = ({ refreshDB }) => {
  const [dues, setDues] = useState<DueConfig[]>(() => StorageService.getData<DueConfig>('u48_dues'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDue, setEditingDue] = useState<Partial<DueConfig> | null>(null);

  const handleManualAssessment = () => {
    if (confirm("Run Global Annual Assessment? This will ensure all members are debited the full year's total based on current configurations (₦21,600 if settings are default).")) {
      StorageService.checkAndApplyAnnualDues();
      refreshDB();
      alert(`Annual assessment protocol executed for all active members.`);
    }
  };

  const openModal = (due?: DueConfig) => {
    setEditingDue(due || {
      dueType: DueType.UNIT,
      billingFrequency: BillingFrequency.MONTHLY,
      amount: 0,
      effectiveStartDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingDue) return;
    const updated = editingDue.id 
      ? dues.map(d => d.id === editingDue.id ? (editingDue as DueConfig) : d)
      : [...dues, { ...(editingDue as DueConfig), id: `d-${Date.now()}` }];
    
    setDues(updated);
    StorageService.saveData('u48_dues', updated);
    refreshDB();
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Configuration</h2>
          <p className="text-slate-500">Managing the unit's annual and monthly assessment rates.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleManualAssessment} className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Trigger Full Year Assessment
          </button>
          <button onClick={() => openModal()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Create Rate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dues.map(config => (
          <div key={config.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative group overflow-hidden">
            <div className="mb-4">
               <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                 config.billingFrequency === BillingFrequency.MONTHLY ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
               }`}>
                 {config.billingFrequency}
               </span>
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{config.dueType} Assessment</h3>
            <p className="text-3xl font-black text-slate-900 mb-6 tracking-tighter">₦{config.amount.toLocaleString()}</p>
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Effective From</p>
                <p className="text-xs font-black text-slate-700 mt-1">{config.effectiveStartDate}</p>
              </div>
              <button onClick={() => openModal(config)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors flex items-center justify-center">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
             <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <h4 className="text-xl font-black uppercase tracking-tight mb-2">Automated Annual Liability Protocol</h4>
            <p className="text-indigo-100/80 leading-relaxed text-sm max-w-2xl">
              Per requirements, the system executes a <strong>Full Year Assessment</strong> at the start of each year. This protocol debits all active members for the <strong>TOTAL</strong> sum of all annual dues plus a 12-month projection of all monthly dues (Current: ₦21,600). This ensures the ledger immediately reflects the total financial obligation for the fiscal year.
            </p>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-10">
           <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
        </div>
      </div>

      {isModalOpen && editingDue && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-sm">Update Configuration</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:opacity-75 transition-opacity">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                  <select value={editingDue.dueType} onChange={e => setEditingDue({...editingDue, dueType: e.target.value as DueType})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    {Object.values(DueType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Frequency</label>
                  <select value={editingDue.billingFrequency} onChange={e => setEditingDue({...editingDue, billingFrequency: e.target.value as BillingFrequency})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    {Object.values(BillingFrequency).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assessment Amount (₦)</label>
                  <input type="number" value={editingDue.amount} onChange={e => setEditingDue({...editingDue, amount: parseFloat(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Effective Start Date</label>
                  <input type="date" value={editingDue.effectiveStartDate} onChange={e => setEditingDue({...editingDue, effectiveStartDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 shadow-xl transition-all uppercase tracking-widest text-xs">
                Commit Config Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuesConfigComponent;
