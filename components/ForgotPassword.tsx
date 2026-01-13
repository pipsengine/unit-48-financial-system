
import React, { useState } from 'react';

interface ForgotPasswordProps {
  onBack: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const [identifier, setIdentifier] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await fetch('http://localhost:3005/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      // Always show success to avoid user enumeration, or show actual result if preferred.
      // The backend returns success: true even if user not found (security best practice),
      // but logs to console if found.
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      // Still show submitted to avoid confusion or reveal errors?
      // Better to show error if network fail.
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
          <p className="text-slate-500 font-medium">We'll send a secure reset link to your registered email.</p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Member ID or Email Address</label>
              <input 
                type="text" 
                required
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="e.g. 02-14381 or john@example.com"
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
              ) : 'Send Reset Link'}
            </button>

            <button 
              type="button"
              onClick={onBack}
              className="w-full text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-center animate-in zoom-in duration-300">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-800 text-sm">
              <p className="font-bold mb-1 italic">Check your inbox!</p>
              If an account exists for <span className="font-mono font-bold text-emerald-900">{identifier}</span>, a secure reset link has been dispatched.
            </div>
            <p className="text-xs text-slate-400 leading-relaxed px-4">
              The link will expire in 15 minutes for security reasons (FR-AUTH-008). 
              If you don't receive it, check your spam folder or contact the Unit Secretary.
            </p>
            <button 
              onClick={onBack}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform active:scale-[0.98] transition-all"
            >
              Return to Login
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
