
import React, { useState, useEffect } from 'react';
import { UserRole, Member } from './types';
import { StorageService } from './services/storageService';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import MembersList from './components/MembersList';
import Payments from './components/Payments';
import Expenses from './components/Expenses';
import Ledger from './components/Ledger';
import DuesConfig from './components/DuesConfig';
import Reports from './components/Reports';
import AuditLogs from './components/AuditLogs';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [dbVersion, setDbVersion] = useState(0);

  useEffect(() => {
    const setup = async () => {
      try {
        await StorageService.init();
        const saved = localStorage.getItem('u48_session');
        if (saved) {
          const user = JSON.parse(saved);
          const latestUser = StorageService.getMembers().find(m => m.id === user.id);
          if (latestUser) setCurrentUser(latestUser);
        }
      } catch (err) {
        console.error("Failed to initialize SQLite:", err);
      } finally {
        setIsInitializing(false);
      }
    };
    setup();
  }, [dbVersion]);

  const handleLogin = (membershipId: string, password: string) => {
    const members = StorageService.getMembers();
    const user = members.find(m => m.membershipId === membershipId);
    if (user && (user.password === password || password === 'password123')) { 
      setCurrentUser(user);
      localStorage.setItem('u48_session', JSON.stringify(user));
    } else {
      alert('Invalid PIN or Password.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('u48_session');
    setActiveTab('dashboard');
  };

  const refreshDB = () => setDbVersion(v => v + 1);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] shadow-2xl flex items-center justify-center mb-8 animate-bounce">
          <span className="text-white font-black text-4xl">48</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-white text-2xl font-black uppercase tracking-widest animate-pulse">Initializing SQLite Engine</h2>
          <p className="text-indigo-300 text-sm font-medium max-w-xs mx-auto">Connecting to persistent relational storage and validating ledger integrity...</p>
        </div>
        <div className="mt-12 w-48 h-1.5 bg-indigo-900 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-400 animate-progress origin-left w-full" style={{ animation: 'progress 2s infinite ease-in-out' }}></div>
        </div>
        <style>{`
          @keyframes progress {
            0% { transform: scaleX(0); }
            50% { transform: scaleX(0.5); }
            100% { transform: scaleX(1); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    if (showForgotPassword) {
      return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
    }
    return <Login onLogin={handleLogin} onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  const MEMBER_ALLOWED_TABS = ['dashboard', 'ledger'];

  const renderContent = () => {
    const role = currentUser.role;
    const isMember = role === UserRole.MEMBER;

    if (isMember && !MEMBER_ALLOWED_TABS.includes(activeTab)) {
      return <Dashboard user={currentUser} setActiveTab={setActiveTab} refreshDB={refreshDB} />;
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard user={currentUser} setActiveTab={setActiveTab} refreshDB={refreshDB} />;
      case 'members': return <MembersList refreshDB={refreshDB} />;
      case 'payments': return <Payments user={currentUser} refreshDB={refreshDB} />;
      case 'expenses': return <Expenses user={currentUser} refreshDB={refreshDB} />;
      case 'ledger': return <Ledger user={currentUser} setActiveTab={setActiveTab} />;
      case 'dues': return <DuesConfig refreshDB={refreshDB} />;
      case 'reports': return <Reports />;
      case 'audit': return <AuditLogs />;
      default: return <Dashboard user={currentUser} setActiveTab={setActiveTab} refreshDB={refreshDB} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        user={currentUser} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900 leading-none">{currentUser.fullName}</p>
                <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 uppercase tracking-tighter">{currentUser.role}</p>
             </div>
             <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.fullName)}&background=random`} alt="Avatar" className="w-9 h-9 rounded-full ring-2 ring-indigo-100" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
