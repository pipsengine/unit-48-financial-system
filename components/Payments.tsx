
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
    notes: '',
    appliedFinancialYear: new Date().getFullYear().toString()
  });

  // Member Search State
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  // Correction State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [correctionMode, setCorrectionMode] = useState<'REVERSE' | 'RECLASSIFY' | 'DELETE'>('RECLASSIFY');
  const [correctionReason, setCorrectionReason] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState('');
  const [newFinancialYear, setNewFinancialYear] = useState('');

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const livePayments = StorageService.getPayments();
  const members = StorageService.getMembers();
  const currentYear = new Date().getFullYear();
  const financialYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

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

  const handleCorrectionClick = (payment: Payment) => {
    setSelectedPaymentId(payment.id);
    setCorrectionMode('RECLASSIFY'); // Default to reclassify as it's more common for errors
    setCorrectionReason('');
    setNewPaymentDate(payment.paymentDate);
    setNewFinancialYear(payment.appliedFinancialYear?.toString() || new Date(payment.paymentDate).getFullYear().toString());
    setShowCorrectionModal(true);
  };

  const confirmCorrection = () => {
    if (!selectedPaymentId) return;

    if (correctionMode === 'DELETE') {
        if (!isSuperAdmin) {
            alert("Only Super Admin can delete payments permanently.");
            return;
        }
        if (confirm("Are you sure you want to PERMANENTLY DELETE this payment and its ledger entries? This action cannot be undone.")) {
            StorageService.deletePayment(selectedPaymentId)
                .then(() => {
                    refreshDB();
                    setShowCorrectionModal(false);
                })
                .catch(err => alert("Deletion failed: " + err.message));
        }
        return;
    }

    if (!correctionReason) {
      alert("Please provide a reason for the correction.");
      return;
    }

    if (correctionMode === 'REVERSE') {
      StorageService.reversePayment(selectedPaymentId, user.id, correctionReason)
        .then(() => {
          refreshDB();
          setShowCorrectionModal(false);
        })
        .catch(err => alert("Reversal failed: " + err.message));
    } else {
      if (!newPaymentDate || !newFinancialYear) {
         alert("Please provide the correct date and financial year.");
         return;
      }
      StorageService.reclassifyPayment(selectedPaymentId, user.id, correctionReason, newPaymentDate, parseInt(newFinancialYear))
        .then(() => {
          refreshDB();
          setShowCorrectionModal(false);
        })
        .catch(err => alert("Reclassification failed: " + err.message));
    }
  };

  // Split Payment State
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitAllocations, setSplitAllocations] = useState<{type: string; year: string; amount: string}[]>([
    { type: 'National Due', year: new Date().getFullYear().toString(), amount: '' }
  ]);

  const addAllocation = () => {
    setSplitAllocations([...splitAllocations, { type: 'National Due', year: new Date().getFullYear().toString(), amount: '' }]);
  };

  const removeAllocation = (index: number) => {
    setSplitAllocations(splitAllocations.filter((_, i) => i !== index));
  };

  const updateAllocation = (index: number, field: keyof typeof splitAllocations[0], value: string) => {
    const newAllocations = [...splitAllocations];
    newAllocations[index] = { ...newAllocations[index], [field]: value };
    setSplitAllocations(newAllocations);
  };

  const totalSplitAmount = splitAllocations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const handleRecordDirect = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPayment.memberId || !newPayment.referenceNumber || !newPayment.paymentDate) {
        alert("Please fill all compulsory fields (Member, Reference, Date).");
        return;
    }

    if (isSplitMode) {
        if (splitAllocations.some(a => !a.amount || parseFloat(a.amount) <= 0)) {
            alert("All split allocations must have a valid amount.");
            return;
        }

        const confirmMsg = `Confirm Split Payment Posting:\n\nTotal Amount: ₦${totalSplitAmount.toLocaleString()}\nAllocations: ${splitAllocations.length}\n\nIs this correct?`;
        if (!window.confirm(confirmMsg)) return;

        const selectedMember = members.find(m => m.id === newPayment.memberId);
        
        // Create multiple payments sharing the same reference
        splitAllocations.forEach((alloc, index) => {
            const payment: Payment = {
                id: `p-${Date.now()}-${index}`,
                memberId: newPayment.memberId,
                memberName: selectedMember?.fullName || 'Unknown',
                amount: parseFloat(alloc.amount),
                paymentDate: newPayment.paymentDate,
                paymentMethod: newPayment.paymentMethod,
                paymentType: alloc.type,
                referenceNumber: newPayment.referenceNumber, // Same Ref
                status: PaymentStatus.VERIFIED,
                notes: `${newPayment.notes} (Split ${index + 1}/${splitAllocations.length})`,
                createdAt: new Date().toISOString(),
                appliedFinancialYear: parseInt(alloc.year)
            };
            StorageService.addPayment(payment, user.id);
        });

        refreshDB();
        setShowSubmitModal(false);
        setMemberSearchQuery('');
        setNewPayment({
            memberId: '',
            amount: '',
            paymentDate: new Date().toISOString().split('T')[0],
            paymentMethod: 'BANK_TRANSFER',
            paymentType: 'National Due',
            referenceNumber: '',
            notes: '',
            appliedFinancialYear: new Date().getFullYear().toString()
        });
        setIsSplitMode(false);
        setSplitAllocations([{ type: 'National Due', year: new Date().getFullYear().toString(), amount: '' }]);
        return;
    }

    if (!newPayment.amount || !newPayment.appliedFinancialYear) {
      alert("Please fill Amount and Financial Year.");
      return;
    }

    const confirmMsg = `Confirm Posting:\n\nApplied Financial Year: ${newPayment.appliedFinancialYear}\nPayment Date: ${newPayment.paymentDate}\nAmount: ₦${parseFloat(newPayment.amount).toLocaleString()}\n\nIs this correct?`;
    if (!window.confirm(confirmMsg)) return;

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
      createdAt: new Date().toISOString(),
      appliedFinancialYear: parseInt(newPayment.appliedFinancialYear)
    };

    StorageService.addPayment(payment, user.id);
    refreshDB();
    setShowSubmitModal(false);
    setMemberSearchQuery('');
    setNewPayment({
      memberId: '',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'BANK_TRANSFER',
      paymentType: 'National Due',
      referenceNumber: '',
      notes: '',
      appliedFinancialYear: new Date().getFullYear().toString()
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

  const filteredMembers = members.filter(m => 
    m.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
    m.membershipId.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Live Payments</h2>
          <p className="text-slate-500">{isAdmin ? 'Verify submissions to update member ledgers.' : 'Review your verified contributions.'}</p>
        </div>
        {user.role === UserRole.SUPER_ADMIN && (
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
                <th className="px-6 py-4">Fin. Year</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Method</th>
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
                  <td className="px-6 py-4 text-slate-600 font-bold text-xs">{payment.appliedFinancialYear}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{payment.paymentDate}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">{payment.paymentMethod.replace('_', ' ')}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">₦{payment.amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                      payment.status === PaymentStatus.VERIFIED ? 'bg-emerald-100 text-emerald-700' : 
                      payment.status === PaymentStatus.PENDING ? 'bg-amber-100 text-amber-700' : 
                      payment.status === PaymentStatus.REVERSED ? 'bg-slate-200 text-slate-500 decoration-slate-500 line-through' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {payment.status === PaymentStatus.PENDING && (
                          <button onClick={() => handleVerify(payment.id)} className="text-emerald-600 hover:underline font-bold text-xs uppercase tracking-widest">Verify</button>
                        )}
                        {isSuperAdmin && payment.status === PaymentStatus.VERIFIED && (
                            <button onClick={() => handleCorrectionClick(payment)} className="text-red-600 hover:underline font-bold text-xs uppercase tracking-widest">Correction</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="px-6 py-12 text-center text-slate-400 italic">No payment records found.</td>
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
                    <div className="relative">
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={(e) => {
                          setMemberSearchQuery(e.target.value);
                          setIsMemberDropdownOpen(true);
                          setNewPayment({...newPayment, memberId: ''});
                        }}
                        onFocus={() => setIsMemberDropdownOpen(true)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                        placeholder="Search Member..."
                      />
                      {isMemberDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[105]" 
                            onClick={() => setIsMemberDropdownOpen(false)}
                          ></div>
                          <div className="absolute z-[110] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {filteredMembers.length > 0 ? (
                              filteredMembers.map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setNewPayment({...newPayment, memberId: m.id});
                                    setMemberSearchQuery(`${m.fullName} (${m.membershipId})`);
                                    setIsMemberDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                                >
                                  <div className="font-bold text-slate-700">{m.fullName}</div>
                                  <div className="text-xs text-slate-400 font-mono">{m.membershipId}</div>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-slate-400 italic text-sm">No members found</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                      <select 
                        value={newPayment.paymentMethod}
                        onChange={e => setNewPayment({...newPayment, paymentMethod: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      >
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="POS">POS Terminal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                      <input 
                        type="date" 
                        required
                        value={newPayment.paymentDate}
                        onChange={e => {
                          const date = e.target.value;
                          const year = date ? new Date(date).getFullYear().toString() : '';
                          setNewPayment({...newPayment, paymentDate: date, appliedFinancialYear: year});
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                     <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={isSplitMode} 
                           onChange={e => setIsSplitMode(e.target.checked)} 
                           className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="text-sm font-bold text-slate-700">Split Payment Allocation</span>
                     </label>
                  </div>

                  {!isSplitMode ? (
                     <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Type</label>
                                <select 
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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Financial Year</label>
                                <input 
                                    type="text"
                                    readOnly
                                    value={newPayment.appliedFinancialYear}
                                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg outline-none text-slate-500 font-bold cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₦)</label>
                                <input 
                                    type="number" 
                                    required={!isSplitMode}
                                    value={newPayment.amount}
                                    onChange={e => setNewPayment({...newPayment, amount: e.target.value})}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference / Teller No</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newPayment.referenceNumber}
                                    onChange={e => setNewPayment({...newPayment, referenceNumber: e.target.value})}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                    placeholder="e.g. TRF-12345678"
                                />
                            </div>
                        </div>
                     </>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                             <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Allocations</h4>
                             <span className="text-xs font-bold text-indigo-600">Total: ₦{totalSplitAmount.toLocaleString()}</span>
                        </div>
                        {splitAllocations.map((alloc, idx) => (
                            <div key={idx} className="flex gap-2 items-end animate-in slide-in-from-left-2 duration-200">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
                                    <select 
                                        value={alloc.type}
                                        onChange={e => updateAllocation(idx, 'type', e.target.value)}
                                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                    >
                                        {PAYMENT_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-20">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Year</label>
                                    <input 
                                        type="text"
                                        value={alloc.year}
                                        onChange={e => updateAllocation(idx, 'year', e.target.value)}
                                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount</label>
                                    <input 
                                        type="number"
                                        value={alloc.amount}
                                        onChange={e => updateAllocation(idx, 'amount', e.target.value)}
                                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 text-right"
                                        placeholder="0.00"
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => removeAllocation(idx)}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    disabled={splitAllocations.length === 1}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        ))}
                        <button 
                            type="button" 
                            onClick={addAllocation}
                            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs uppercase hover:border-indigo-500 hover:text-indigo-500 transition-all"
                        >
                            + Add Allocation Line
                        </button>

                         <div className="pt-2 border-t border-slate-200">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference / Teller No</label>
                            <input 
                                type="text" 
                                required
                                value={newPayment.referenceNumber}
                                onChange={e => setNewPayment({...newPayment, referenceNumber: e.target.value})}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                placeholder="e.g. TRF-12345678"
                            />
                        </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes (Optional)</label>
                    <textarea 
                      value={newPayment.notes}
                      onChange={e => setNewPayment({...newPayment, notes: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 h-20 resize-none"
                      placeholder="Additional details..."
                    />
                  </div>
               </div>
               <div className="flex gap-4 pt-4 border-t border-slate-100">
                 <button 
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 transition-all"
                 >
                   Record Payment
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showCorrectionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold uppercase tracking-widest">Payment Correction</h3>
              <button onClick={() => setShowCorrectionModal(false)} className="text-white hover:opacity-75 transition-opacity">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              
              {/* Mode Selection */}
              <div className="flex p-1 bg-slate-100 rounded-lg gap-1">
                <button 
                  onClick={() => setCorrectionMode('RECLASSIFY')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${correctionMode === 'RECLASSIFY' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Correct Date
                </button>
                <button 
                  onClick={() => setCorrectionMode('REVERSE')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${correctionMode === 'REVERSE' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Reverse
                </button>
                {isSuperAdmin && (
                  <button 
                    onClick={() => setCorrectionMode('DELETE')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${correctionMode === 'DELETE' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className={`border p-4 rounded-xl text-xs ${correctionMode === 'DELETE' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                <p className="font-bold mb-1">
                    {correctionMode === 'DELETE' ? 'DANGER ZONE:' : 'Audit Warning:'}
                </p>
                {correctionMode === 'REVERSE' && "This will permanently reverse the payment via a contra-entry. The original record will be preserved but marked as reversed."}
                {correctionMode === 'RECLASSIFY' && "This will reverse the original payment and create a NEW payment record with the corrected details. Both actions will be logged."}
                {correctionMode === 'DELETE' && "This will PERMANENTLY REMOVE the payment and its associated ledger entries from the database. This action CANNOT be undone and destroys the audit trail."}
              </div>

              {correctionMode === 'RECLASSIFY' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correct Date</label>
                    <input 
                      type="date" 
                      value={newPaymentDate}
                      onChange={e => setNewPaymentDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Financial Year</label>
                    <select 
                      value={newFinancialYear}
                      onChange={e => setNewFinancialYear(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    >
                      {financialYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {correctionMode !== 'DELETE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason for Correction (Required)</label>
                    <textarea 
                      required
                      value={correctionReason}
                      onChange={e => setCorrectionReason(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 h-24 resize-none"
                      placeholder="e.g., Wrong financial year selected, Operator error..."
                    />
                  </div>
              )}

              <div className="flex gap-3 pt-2">
                 <button 
                  onClick={() => setShowCorrectionModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                  onClick={confirmCorrection}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-all ${
                    correctionMode === 'REVERSE' 
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' 
                      : correctionMode === 'DELETE'
                        ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                 >
                   {correctionMode === 'REVERSE' ? 'Confirm Reversal' : correctionMode === 'DELETE' ? 'Permanently Delete' : 'Apply Correction'}
                 </button>
              </div>
            </div>
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
