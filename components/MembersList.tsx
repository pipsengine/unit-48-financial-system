
import React, { useState } from 'react';
import { MemberStatus, UserRole, Member } from '../types';
import { StorageService } from '../services/storageService';

interface MembersListProps {
  refreshDB: () => void;
  currentUser: Member;
}

const MembersList: React.FC<MembersListProps> = ({ refreshDB, currentUser }) => {
  const [members, setMembers] = useState<Member[]>(() => StorageService.getMembers());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Partial<Member> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | MemberStatus>('ALL');

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         m.membershipId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const openModal = (member?: Member) => {
    setEditingMember(member || {
      fullName: '',
      email: '',
      phone: '',
      membershipId: '',
      status: MemberStatus.ACTIVE,
      role: UserRole.MEMBER,
      dateOfJoining: new Date().toISOString().split('T')[0],
      balance: 0,
      password: 'password123',
      address: '',
      dob: ''
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    if (!editingMember.membershipId || !editingMember.fullName) {
      alert('Required fields missing.');
      return;
    }

    // Credential Validation
    if (!editingMember.id) {
      // Check uniqueness for new members
      const existingId = members.find(m => m.membershipId === editingMember.membershipId);
      if (existingId) {
        alert('Membership ID already exists. Please use a unique ID.');
        return;
      }
      const existingEmail = members.find(m => m.email === editingMember.email);
      if (existingEmail) {
        alert('Email address already registered.');
        return;
      }
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editingMember.email && !emailRegex.test(editingMember.email)) {
      alert('Please enter a valid email address.');
      return;
    }

    const updatedMember = editingMember.id 
      ? (editingMember as Member) 
      : { ...(editingMember as Omit<Member, 'id'>), id: `m-${Date.now()}` };
    
    StorageService.updateMember(updatedMember);
    setMembers(StorageService.getMembers());
    refreshDB();
    setIsModalOpen(false);
  };

  const handleDelete = (memberId: string) => {
    if (window.confirm('Are you sure you want to delete this member? This action cannot be undone.')) {
      StorageService.deleteMember(memberId);
      setMembers(StorageService.getMembers());
      refreshDB();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Management</h2>
          <p className="text-slate-500">Managing {members.length} registered Unit 48 personnel.</p>
        </div>
        {currentUser.role === UserRole.SUPER_ADMIN && (
          <button 
            onClick={() => openModal()}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Add New Member
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search registry..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
             {['ALL', MemberStatus.ACTIVE, MemberStatus.SUSPENDED].map(s => (
               <button 
                key={s}
                onClick={() => setFilterStatus(s as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
               >
                 {s}
               </button>
             ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Identity</th>
                <th className="px-6 py-4">Role / Rank</th>
                <th className="px-6 py-4">Contact Details</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ledger Balance</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map(member => (
                <tr key={member.id} className="text-sm hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}&background=random`} className="w-8 h-8 rounded-full shadow-inner" alt="" />
                      <div>
                        <p className="font-bold text-slate-900">{member.fullName}</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{member.membershipId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{member.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-600 font-medium">{member.email}</p>
                    <p className="text-xs text-slate-400">{member.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                      member.status === MemberStatus.ACTIVE ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-black ${member.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₦{member.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openModal(member)} className="text-indigo-600 font-bold text-xs uppercase hover:underline">Edit</button>
                      {currentUser.role === UserRole.SUPER_ADMIN && member.role !== UserRole.SUPER_ADMIN && (
                        <button onClick={() => handleDelete(member.id)} className="text-red-600 font-bold text-xs uppercase hover:underline">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black uppercase tracking-widest text-sm">{editingMember.id ? 'Modify Registry' : 'Register New Member'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:opacity-75 transition-opacity">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Full Legal Name</label>
                  <input required value={editingMember.fullName} onChange={e => setEditingMember({...editingMember, fullName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Member ID / PIN</label>
                  <input 
                    required 
                    disabled={!!editingMember.id}
                    value={editingMember.membershipId} 
                    onChange={e => setEditingMember({...editingMember, membershipId: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm disabled:opacity-60 disabled:cursor-not-allowed" 
                    placeholder="U48-XXXX" 
                  />
                  {editingMember.id && <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase">System ID is immutable after registration</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Email Address</label>
                  <input required type="email" value={editingMember.email} onChange={e => setEditingMember({...editingMember, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Joining Date</label>
                  <input required type="date" value={editingMember.dateOfJoining} onChange={e => setEditingMember({...editingMember, dateOfJoining: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Phone</label>
                  <input required value={editingMember.phone} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Home Address</label>
                   <textarea value={editingMember.address} onChange={e => setEditingMember({...editingMember, address: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl h-20 resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Role</label>
                  <select value={editingMember.role} onChange={e => setEditingMember({...editingMember, role: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-600">
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Account Status</label>
                  <select value={editingMember.status} onChange={e => setEditingMember({...editingMember, status: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    {Object.values(MemberStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 shadow-xl transition-all uppercase tracking-widest text-xs">
                Commit Registry Update
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersList;
