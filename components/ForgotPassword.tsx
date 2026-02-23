
import React, { useState } from 'react';

interface ForgotPasswordProps {
  onBack: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const [identifier, setIdentifier] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const API_URL = '/api';
    
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      setSubmitted(true);
      setStage('verify');
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-900 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-8 m-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 text-indigo-600 rounded-xl mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">Reset Password</h2>
          <p className="text-slate-500 font-medium">We will send a one-time code to your registered phone.</p>
        </div>

        {stage === 'request' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Member ID or Phone Number</label>
              <input 
                type="text" 
                required
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="e.g. 02-14381 or 08012345678"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Send Code'}
            </button>

            <button 
              type="button"
              onClick={onBack}
              className="w-full text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Back to Login
            </button>
          </form>
        )}

        {stage === 'verify' && (
          <div className="space-y-6 text-center animate-in zoom-in duration-300">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-800 text-sm text-left space-y-2">
              <p className="font-bold">Verification code sent</p>
              <p className="text-xs text-slate-600">
                If an account exists for <span className="font-mono font-bold text-emerald-900">{identifier}</span>, a six-digit code has been sent to the registered phone number.
              </p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs font-medium">
                {error}
              </div>
            )}
            <form
              onSubmit={async (e) => {
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
                  setError('Password must include upper, lower, number, and special character.');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setError('Passwords do not match.');
                  return;
                }
                setLoading(true);
                try {
                  const API_URL = '/api';
                  const res = await fetch(`${API_URL}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: code, newPassword })
                  });
                  const data = await res.json();
                  if (res.ok) {
                    alert('Password reset successful. Please login with your new password.');
                    onBack();
                  } else {
                    setError(data.error || 'Failed to reset password.');
                  }
                } catch (err) {
                  console.error(err);
                  setError('Failed to connect to server. Please try again.');
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4 text-left"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Verification Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono tracking-widest text-center"
                  placeholder="Enter 6-digit code"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Re-enter password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform active:scale-[0.98] transition-all"
              >
                {loading ? 'Resetting...' : 'Verify Code & Reset Password'}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mt-2"
              >
                Cancel and go back
              </button>
            </form>
            <button 
              onClick={() => {
                setStage('request');
                setSubmitted(false);
                setCode('');
                setNewPassword('');
                setConfirmPassword('');
                setError(null);
              }}
              className="w-full text-xs text-slate-400 hover:text-slate-600 font-semibold mt-2"
            >
              Start over
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Security Protocol</p>
          <p className="text-[10px] text-slate-400 mt-1 italic">Automated Identity Verification • Unit 48 Security</p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
