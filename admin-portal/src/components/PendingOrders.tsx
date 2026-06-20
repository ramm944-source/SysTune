'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetchApi } from '../lib/fetchApi';

const fetcher = async (url: string) => {
  const data = await fetchApi(url);
  return data.orders || [];
};

export default function PendingOrders() {
  const { data: orders, error, isLoading, mutate } = useSWR('/api/admin/orders', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAction = async (txnId: string, action: 'approve' | 'reject') => {
    setProcessingId(txnId);
    try {
      await fetchApi('/api/admin/orders/action', {
        method: 'POST',
        body: JSON.stringify({ action, txn_id: txnId }),
      });
      // Re-fetch orders instantly
      mutate();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col p-4 sm:p-8 lg:p-12 animate-in fade-in duration-700 w-full">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight flex items-center gap-3">
            <span className="text-3xl sm:text-4xl text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]">📥</span>
            Pending Orders Queue
          </h1>
          <p className="text-zinc-500 mt-2 text-xs sm:text-sm max-w-xl leading-relaxed">
            Real-time synchronization with Stripe and manual payment gateways. Approve orders to securely provision endpoints.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => mutate()}
            className="w-full sm:w-auto px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium rounded-lg transition-all shadow-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4 text-indigo-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 2v6h6"/></svg>
            )}
            Sync Gateway
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 backdrop-blur-md">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span className="text-sm font-medium">Gateway Error: {error.message}</span>
        </div>
      )}

      {/* Grid List */}
      <div className="w-full">
        {isLoading && !orders ? (
           <div className="flex justify-center items-center h-40">
             <div className="flex items-center gap-3 text-zinc-500">
               <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
               Polling transaction endpoints...
             </div>
           </div>
        ) : orders?.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-16 text-center shadow-inner">
             <div className="text-4xl mb-4 opacity-50">☕</div>
             <h3 className="text-xl font-medium text-zinc-300 mb-2">Queue is Empty</h3>
             <p className="text-zinc-500 text-sm">All pending orders have been processed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders?.map((order: any, idx: number) => (
              <div key={idx} className="bg-black/40 backdrop-blur-xl border border-white/[0.08] hover:border-indigo-500/30 rounded-2xl p-6 transition-all shadow-[0_4px_24px_rgba(0,0,0,0.4)] group relative overflow-hidden">
                {/* Glow effect */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none transition-all group-hover:bg-indigo-500/20"></div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                    {order.package || 'Unknown Package'}
                  </div>
                  <span className="text-zinc-600 font-mono text-[10px]">{new Date(order.timestamp || Date.now()).toLocaleDateString()}</span>
                </div>
                
                <h3 className="text-lg font-medium text-zinc-100 mb-1">{order.name}</h3>
                <div className="text-sm text-zinc-400 mb-4 flex flex-col gap-1">
                  <span className="flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> {order.email}</span>
                  <span className="flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> {order.phone}</span>
                </div>
                
                <div className="text-xs text-zinc-600 font-mono mb-6 bg-black/50 p-2 rounded-lg border border-white/5 truncate" title={order.transaction_id}>
                  TXN: {order.transaction_id}
                </div>
                
                <div className="flex gap-3 relative z-10">
                  <button
                    onClick={() => handleAction(order.transaction_id, 'approve')}
                    disabled={processingId === order.transaction_id}
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 font-medium py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(34,197,94,0.05)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] text-sm disabled:opacity-50"
                  >
                    {processingId === order.transaction_id ? 'Wait...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleAction(order.transaction_id, 'reject')}
                    disabled={processingId === order.transaction_id}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] text-sm disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
