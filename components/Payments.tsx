
import React, { useState } from 'react';
import { Member, UserRole, PaymentStatus, Payment } from '../types';
import { StorageService } from '../services/storageService';

interface PaymentsProps {
  user: Member;
  refreshDB: () => void;
}

const Payments: React.FC<PaymentsProps> = ({ user, refreshDB }) => {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | PaymentStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Payment Form State
  const [newPayment, setNewPayment] = useState({
    memberId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    paymentType: 'National Due',
    referenceNumber: '',
    notes: ''
  });

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const livePayments = StorageService.getPayments();
  const members = StorageService.getMembers();

  const filteredPayments = livePayments.filter(payment => {
    const matchesFilter = filter === 'ALL' || payment.status === filter;
    const matchesSearch = payment.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         payment.memberName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUser = isAdmin ? true : payment.memberId === user.id;
    return matchesFilter && matchesSearch && matchesUser;
  });

  const handleVerify = (id: string) => {
    StorageService.verifyPayment(id, user.id);
    refreshDB();
  };

  const handleRecordDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.memberId || !newPayment.amount || !newPayment.referenceNumber) {
      alert("Please fill all compulsory fields.");
      return;
    }

    const selectedMember = members.find(m => m.id === newPayment.memberId);
    
    const payment: Payment = {
      id: `p-${Date.now()}`,
      memberId: newPayment.memberId,
      memberName: selectedMember?.fullName || 'Unknown',
      amount: parseFloat(newPayment.amount),
      paymentDate: newPayment.paymentDate,
      paymentMethod: newPayment.paymentMethod,
      paymentType: newPayment.paymentType,
      referenceNumber: newPayment.referenceNumber,
      status: PaymentStatus.VERIFIED, // Direct payments are verified immediately
      notes: newPayment.notes,
      createdAt: new Date().toISOString()
    };

    StorageService.addPayment(payment, user.id);
    refreshDB();
    setShowSubmitModal(false);
    setNewPayment({
      memberId: '',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'BANK_TRANSFER',
      paymentType: 'National Due',
      referenceNumber: '',
      notes: ''
    });
  };

  const PAYMENT_TYPES = [
    'National Due',
    'Unit Due',
    'Welfare Due',
    'Outstanding',
    'Development Levy',
    'Project Support',
    'Command Refreshment',
    'Donations',
    'Historical Payment',
    'Opening Balance'
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Live Payments</h2>
          <p className="text-slate-500">{isAdmin ? 'Verify submissions to update member ledgers.' : 'Review your verified contributions.'}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSubmitModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Record Direct Payment
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Filter ref or name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
             <FilterTab label="All" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
             <FilterTab label="Pending" active={filter === PaymentStatus.PENDING} onClick={() => setFilter(PaymentStatus.PENDING)} />
             <FilterTab label="Verified" active={filter === PaymentStatus.VERIFIED} onClick={() => setFilter(PaymentStatus.VERIFIED)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Ref Number</th>
                {isAdmin && <th className="px-6 py-4">Member</th>}
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Status</th>
                {isAdmin && <th className="px-6 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length > 0 ? filteredPayments.map(payment => (
                <tr key={payment.id} className="text-sm hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-600">{payment.referenceNumber}</td>
                  {isAdmin && <td className="px-6 py-4 text-slate-900 font-bold">{payment.memberName}</td>}
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{payment.paymentType || 'General'}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">₦{payment.amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                      payment.status === PaymentStatus.VERIFIED ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      {payment.status === PaymentStatus.PENDING && (
                        <button onClick={() => handleVerify(payment.id)} className="text-emerald-600 hover:underline font-bold text-xs uppercase tracking-widest">Verify</button>
                      )}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 4} className="px-6 py-12 text-center text-slate-400 italic">No payment records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold uppercase tracking-widest">Record Direct Payment</h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-white hover:opacity-75 transition-opacity">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleRecordDirect} className="p-8 space-y-6">
               <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Member</label>
                    <select 
                      required
                      value={newPayment.memberId}
                      onChange={e => setNewPayment({...newPayment, memberId: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    >
                      <option value="">Choose Member...</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.fullName} ({m.membershipId})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Type</label>
                      <select 
                        required
                        value={newPayment.paymentType}
                        onChange={e => setNewPayment({...newPayment, paymentType: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      >
                        {PAYMENT_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                      <select 
                        value={newPayment.paymentMethod}
                        onChange={e => setNewPayment({...newPayment, paymentMethod: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      >
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash Collection</option>
                        <option value="POS">POS Terminal</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₦)</label>
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={newPayment.amount}
                        onChange={e => setNewPayment({...newPayment, amount: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                      <input 
                        required
                        type="date"
                        value={newPayment.paymentDate}
                        onChange={e => setNewPayment({...newPayment, paymentDate: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference Number</label>
                    <input 
                      required
                      type="text"
                      value={newPayment.referenceNumber}
                      onChange={e => setNewPayment({...newPayment, referenceNumber: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="e.g. TRNX_2026_01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes / Description</label>
                    <textarea 
                      value={newPayment.notes}
                      onChange={e => setNewPayment({...newPayment, notes: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Optional details about this payment..."
                      rows={2}
                    />
                  </div>
               </div>
               <button type="submit" className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 shadow-xl transition-all uppercase tracking-widest text-sm">
                  Commit to Ledger
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterTab = ({ label, active, onClick }: any) => (
  <button onClick={onClick} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>
    {label}
  </button>
);

export default Payments;
