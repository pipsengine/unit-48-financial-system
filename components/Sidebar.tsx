
import React from 'react';
import { UserRole, Member } from '../types';
import { StorageService } from '../services/storageService';

interface SidebarProps {
  user: Member;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, setActiveTab, onLogout, isOpen, setIsOpen }) => {
  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  const isSuper = user.role === UserRole.SUPER_ADMIN;
  const isAuditor = user.role === UserRole.AUDITOR;
  const isMember = user.role === UserRole.MEMBER;

  const handleReset = () => {
    if (confirm("DANGER: This will wipe the LIVE database and restore initial seeds. Proceed?")) {
      StorageService.resetSystem();
    }
  };

  const NavItem = ({ id, label, icon, hidden = false }: { id: string, label: string, icon: React.ReactNode, hidden?: boolean }) => {
    if (hidden) return null;
    const active = activeTab === id;
    return (
      <button
        onClick={() => {
          setActiveTab(id);
          setIsOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
          active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-12 h-12 flex-shrink-0">
              <img src="/Logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-800 leading-tight">Unit 48<br/><span className="text-indigo-600 text-sm font-bold">Payment System</span></span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            <NavItem id="dashboard" label="Dashboard" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
            <NavItem id="ledger" label="My Ledger" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
            
            {/* Restricted pages: only for Admin/Super Admin/Auditor roles as per requirements */}
            <NavItem id="payments" label="Payments" hidden={isMember} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
            <NavItem id="expenses" label="Expenses" hidden={isMember} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            
            {(isAdmin || isAuditor) && <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrator</div>}
            <NavItem id="members" label="Members" hidden={!isAdmin && !isAuditor} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            <NavItem id="general_ledger" label="General Ledger" hidden={!isAdmin && !isAuditor} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>} />
            <NavItem id="balance_sheet" label="Balance Sheet" hidden={!isAdmin && !isAuditor} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>} />
            <NavItem id="dues" label="Dues Config" hidden={!isAdmin} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>} />
            <NavItem id="reports" label="Reports" hidden={!(isAdmin || isAuditor)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
            <NavItem id="audit" label="Audit Logs" hidden={!(isSuper || isAuditor)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </nav>

          <div className="mt-auto space-y-2 border-t border-slate-100 pt-6">
            <div className="px-4 py-2 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">DB Status</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">LIVE</span>
              </span>
            </div>
            {isSuper && (
              <button onClick={handleReset} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Reset Database
              </button>
            )}
            <button onClick={() => onLogout()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
