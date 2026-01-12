
import React, { useState } from 'react';
import { Member, UserRole, ExpenseStatus, Expense } from '../types';
import { StorageService } from '../services/storageService';

interface ExpensesProps {
  user: Member;
  refreshDB: () => void;
}

const Expenses: React.FC<ExpensesProps> = ({ user, refreshDB }) => {
  const [showModal, setShowModal] = useState(false);
  const [newExp, setNewExp] = useState({
    title: '',
    category: 'ADMINISTRATIVE',
    amount: '',
    incurredDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const liveExpenses = StorageService.getExpenses();

  const handleStatusUpdate = (id: string, status: ExpenseStatus) => {
    StorageService.updateExpenseStatus(id, status, user.id);
    refreshDB();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const expense: Expense = {
      id: `e-${Date.now()}`,
      title: newExp.title,
      description: newExp.description,
      category: newExp.category,
      amount: parseFloat(newExp.amount),
      incurredDate: newExp.incurredDate,
      submittedBy: user.id,
      status: ExpenseStatus.UNDER_REVIEW,
      createdAt: new Date().toISOString()
    };
    StorageService.addExpense(expense, user.id);
    refreshDB();
    setShowModal(false);
    setNewExp({ title: '', category: 'ADMINISTRATIVE', amount: '', incurredDate: new Date().toISOString().split('T')[0], description: '' });
  };

  const getStatusColor = (status: ExpenseStatus) => {
    switch (status) {
      case ExpenseStatus.APPROVED: return 'bg-indigo-50 text-indigo-600';
      case ExpenseStatus.PAID: return 'bg-emerald-50 text-emerald-600';
      case ExpenseStatus.REJECTED: return 'bg-red-50 text-red-600';
      default: return 'bg-amber-50 text-amber-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Expenses & Claims</h2>
          <p className="text-slate-500">Unit 48 reimbursement and procurement workflow.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          New Claim
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {Object.values(ExpenseStatus).filter(s => s !== ExpenseStatus.DRAFT && s !== ExpenseStatus.CANCELLED).map(status => (
            <div key={status} className={`p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between ${getStatusColor(status)}`}>
              <span className="text-[10px] font-black uppercase tracking-widest">{status.replace('_', ' ')}</span>
              <span className="text-lg font-black">{liveExpenses.filter(e => e.status === status).length}</span>
            </div>
          ))}
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {liveExpenses.length > 0 ? liveExpenses.map(exp => (
                <div key={exp.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900 leading-tight">{exp.title}</h4>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{exp.category} • {exp.incurredDate}</p>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-1">{exp.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <span className="text-xl font-black text-slate-900 tracking-tighter">₦{exp.amount.toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${getStatusColor(exp.status)}`}>
                      {exp.status.replace('_', ' ')}
                    </span>
                    {isAdmin && exp.status === ExpenseStatus.UNDER_REVIEW && (
                      <div className="flex gap-3 mt-1">
                        <button onClick={() => handleStatusUpdate(exp.id, ExpenseStatus.APPROVED)} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Approve</button>
                        <button onClick={() => handleStatusUpdate(exp.id, ExpenseStatus.REJECTED)} className="text-[10px] font-black text-red-600 uppercase hover:underline">Reject</button>
                      </div>
                    )}
                    {isAdmin && exp.status === ExpenseStatus.APPROVED && (
                      <button onClick={() => handleStatusUpdate(exp.id, ExpenseStatus.PAID)} className="text-[10px] font-black text-emerald-600 uppercase hover:underline">Mark as Paid</button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-slate-400 italic">No expense requests logged in the system.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                 <h3 className="font-black uppercase tracking-widest text-sm">New Financial Claim</h3>
                 <button onClick={() => setShowModal(false)} className="hover:opacity-75 transition-opacity">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expense Title</label>
                      <input required value={newExp.title} onChange={e => setNewExp({...newExp, title: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="e.g. Unit Maintenance" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total (₦)</label>
                         <input required type="number" value={newExp.amount} onChange={e => setNewExp({...newExp, amount: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-lg" placeholder="0.00" />
                       </div>
                       <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Incurred Date</label>
                         <input required type="date" value={newExp.incurredDate} onChange={e => setNewExp({...newExp, incurredDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                       </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</label>
                      <select value={newExp.category} onChange={e => setNewExp({...newExp, category: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                         <option>ADMINISTRATIVE</option>
                         <option>HOSPITALITY</option>
                         <option>LOGISTICS</option>
                         <option>EQUIPMENT</option>
                         <option>OTHER</option>
                      </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Narrative Justification</label>
                       <textarea required value={newExp.description} onChange={e => setNewExp({...newExp, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl h-24 resize-none text-sm" placeholder="Provide full context for this claim..." />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 shadow-xl transition-all uppercase tracking-widest text-xs">
                    Dispatch for Review
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
