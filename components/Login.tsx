
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (id: string, password: string) => void;
  onForgotPassword: () => void;
  showDefaultCredentials?: boolean;
  errorMessage?: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, onForgotPassword, showDefaultCredentials = true, errorMessage }) => {
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(pin, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-8 m-4 animate-in fade-in zoom-in duration-300">
        {errorMessage && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm animate-pulse">
            <p className="text-red-700 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {errorMessage}
            </p>
          </div>
        )}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
            <img src="/Logo.png" alt="Unit 48 Logo" className="w-full h-full object-contain drop-shadow-xl" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tighter">Unit 48 Payment System</h2>
          <p className="text-slate-500 font-medium italic text-sm">Financial Management & Registry</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Membership Identity</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
                <input 
                  type="text" 
                  required
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono font-bold text-slate-700"
                  placeholder="00-00000"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Secure PIN / Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold text-slate-700"
                  placeholder="••••••••"
                />
              </div>
              {showDefaultCredentials && (
                <p className="mt-1 ml-1 text-[10px] text-slate-400 font-medium">
                  Default Password: <span className="font-mono font-bold text-slate-600">Admin123</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 transition-colors" />
              <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Remember Session</span>
            </label>
            <button 
              type="button"
              onClick={onForgotPassword}
              className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest transition-colors"
            >
              Reset PIN?
            </button>
          </div>

          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 transform active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs"
          >
            Authenticate Access
          </button>
        </form>

        <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-2">
          <p className="text-[9px] text-slate-400 uppercase tracking-[0.3em] font-black">Financial Integrity Secured</p>
          <div className="flex gap-4">
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">NDPR Compliant</span>
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">SQLite Persistent</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
