import React, { useState } from 'react';

interface ResetPasswordProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ token, onSuccess, onCancel }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    
    try {
      const res = await fetch('http://localhost:3005/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-8 m-4 animate-in fade-in zoom-in duration-300">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 text-amber-600 rounded-xl mb-2 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tighter">Set New Password</h2>
          <p className="text-slate-500 font-medium text-sm">
            Enter your new secure password below.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">New Password</label>
              <input 
                type="password" 
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold text-slate-700"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Confirm New Password</label>
              <input 
                type="password" 
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold text-slate-700"
                placeholder="Re-enter password"
              />
            </div>
          </div>

          <div className="space-y-3">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 transform active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2"
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </button>
            
            <button 
              type="button"
              onClick={onCancel}
              className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider py-2 transition-colors"
            >
              Cancel & Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
