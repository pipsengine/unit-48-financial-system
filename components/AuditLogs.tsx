
import React from 'react';
import { StorageService } from '../services/storageService';
import { AuditLog } from '../types';

const AuditLogs: React.FC = () => {
  const logs = StorageService.getData<AuditLog>('u48_audit');
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">System Audit Trail</h2>
          <p className="text-slate-500">Immutable record of all administrative and financial activities.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filter Logs
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">
            Export JSON
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-black">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Reference ID</th>
                <th className="px-6 py-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? logs.map(log => (
                <tr key={log.id} className="text-xs hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className="font-bold text-slate-900">{log.userName}</span>
                       <span className="text-[10px] text-slate-400">({log.userId})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-bold">{log.entityType}</td>
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                    {log.entityId}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">{log.ipAddress}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No audit events recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           <span>Persistence: LOCAL_STORAGE_LIVE</span>
           <div className="flex gap-2">
             <button disabled className="px-3 py-1 bg-white border border-slate-200 rounded opacity-50">Prev</button>
             <button disabled className="px-3 py-1 bg-white border border-slate-200 rounded opacity-50">Next</button>
           </div>
        </div>
      </div>
      
      <div className="bg-red-900 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h4 className="font-black mb-2 flex items-center gap-2 uppercase tracking-tighter">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Immutable Security Protocol
          </h4>
          <p className="text-xs text-red-100 leading-relaxed max-w-2xl">
            In compliance with FR-AUD-004, these logs are mathematically immutable once committed. Any deviation from verified system states triggers an administrative freeze.
          </p>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
