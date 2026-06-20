'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetchApi } from '../lib/fetchApi';

const fetcher = async (url: string) => {
  const data = await fetchApi(url);
  return data.clients || [];
};

export default function ClientDirectory() {
  const [showModal, setShowModal] = useState(false);
  const [showTuneModal, setShowTuneModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimLink, setClaimLink] = useState('');
  const [claimCopied, setClaimCopied] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [tuneData, setTuneData] = useState({ tier: '', tokens_left: '' });
  const [clientData, setClientData] = useState({ name: '', phone: '', email: '', package_id: 'Annual Pass', hwid: '' });
  const [generateError, setGenerateError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTuning, setIsTuning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState<string | null>(null);

  const { data: clients, error, isLoading, mutate } = useSWR('/api/admin/bulk-clients', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateError('');
    setIsGenerating(true);
    try {
      const res = await fetchApi('/api/admin/manual-key', {
        method: 'POST',
        body: JSON.stringify(clientData),
      });
      // Check if this was a claim key (no HWID provided)
      if (!clientData.hwid.trim()) {
        const generatedHwid = res.client?.hwid || '';
        if (generatedHwid) {
          const claimId = generatedHwid.replace('MANUAL-', 'CLAIM-');
          setClaimLink(`systune://activate/${claimId}`);
          setClaimCopied(false);
          setShowClaimModal(true);
        }
      }
      setShowModal(false);
      setClientData({ name: '', phone: '', email: '', package_id: 'Annual Pass', hwid: '' });
      mutate();
    } catch (err: any) {
      setGenerateError(err.message || 'Key generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyHwid = (hwid: string) => {
    navigator.clipboard.writeText(hwid);
    setCopiedHwid(hwid);
    setTimeout(() => setCopiedHwid(null), 2000);
  };

  const openTuneModal = (client: any) => {
    setSelectedClient(client);
    setTuneData({ tier: client.tier || client.package_id || '', tokens_left: String(client.tokens_left || 0) });
    setShowTuneModal(true);
  };

  const handleTuneSave = async () => {
    if (!selectedClient) return;
    setIsTuning(true);
    try {
      await fetchApi('/api/admin/update-client', {
        method: 'POST',
        body: JSON.stringify({ hwid: selectedClient.hwid, tier: tuneData.tier, tokens_left: parseInt(tuneData.tokens_left) || 0 }),
      });
      setShowTuneModal(false);
      mutate();
    } catch (err: any) {
      alert(`Tune failed: ${err.message}`);
    } finally {
      setIsTuning(false);
    }
  };

  const openDeleteModal = (client: any) => {
    setSelectedClient(client);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    setIsDeleting(true);
    try {
      await fetchApi('/api/admin/delete-client', {
        method: 'POST',
        body: JSON.stringify({ hwid: selectedClient.hwid }),
      });
      setShowDeleteModal(false);
      mutate();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyClaimLink = () => {
    navigator.clipboard.writeText(claimLink);
    setClaimCopied(true);
    setTimeout(() => setShowClaimModal(false), 2000);
  };

  return (
    <div className="flex flex-col p-4 sm:p-8 lg:p-12 animate-in fade-in duration-700 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight flex items-center gap-3">
            <span className="text-3xl sm:text-4xl text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">🛡️</span>
            Active Client Matrix
          </h1>
          <p className="text-zinc-500 mt-2 text-xs sm:text-sm max-w-xl leading-relaxed">
            Real-time zero-trust directory. Monitor authenticated endpoints, hardware linkages, and exact billing quota.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={() => mutate()} className="w-full sm:w-auto px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-medium rounded-lg transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
            {isLoading ? <svg className="animate-spin h-4 w-4 text-cyan-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 2v6h6"/></svg>}
            Force Sync
          </button>
          <button onClick={() => setShowModal(true)} className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-500/90 to-indigo-600/90 hover:from-cyan-400 hover:to-indigo-500 border border-cyan-400/30 text-white font-medium rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Provision Key
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 backdrop-blur-md">
          <span className="text-sm font-medium">Critical Network Error: {error.message}</span>
        </div>
      )}

      {/* Data Grid — 8 Columns */}
      <div className="bg-black/40 backdrop-blur-2xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Identity</th>
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contact</th>
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tier</th>
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Quota</th>
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Hardware Signature</th>
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Last Seen</th>
                <th className="px-5 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading && !clients ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-zinc-500 text-sm"><div className="flex items-center justify-center gap-3"><svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Establishing secure tunnel...</div></td></tr>
              ) : clients?.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-zinc-500 text-sm italic">Registry is currently empty. Provision a key to begin.</td></tr>
              ) : (
                clients?.map((client: any, idx: number) => {
                  const lastSeen = client.last_seen_time ? (client.last_seen_time.length > 16 ? client.last_seen_time.substring(0, 16).replace('T', ' ') : client.last_seen_time) : 'N/A';
                  const location = client.last_seen_geo || 'N/A';
                  return (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-zinc-200 group-hover:text-cyan-400 transition-colors">{client.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{client.email}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-400 font-mono">{client.phone}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)] uppercase">
                          {client.tier || client.package_id}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-right">
                        <span className="font-mono font-medium text-cyan-400">{client.tokens_left}</span>
                        <span className="text-zinc-600 text-xs ml-1">tks</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${client.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></span>
                          <span className={`text-xs font-medium uppercase tracking-wider ${client.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>{client.status}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-zinc-500 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="truncate w-32 inline-block bg-black/50 px-2 py-1 rounded border border-white/5">{client.hwid || 'Awaiting Sync'}</span>
                          <button onClick={() => handleCopyHwid(client.hwid)} className={`transition-all ${copiedHwid === client.hwid ? 'text-green-400' : 'opacity-0 group-hover:opacity-100 hover:text-cyan-400'}`} title="Copy HWID">
                            {copiedHwid === client.hwid ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-xs text-zinc-500">{lastSeen}</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">{location}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openTuneModal(client)} className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors" title="Tune Plan & Tokens">🔧 Tune</button>
                          <button onClick={() => openDeleteModal(client)} className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors" title="Revoke Client">❌</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-white/[0.04] bg-white/[0.01] flex justify-between items-center text-xs text-zinc-500">
          <span>Showing {clients?.length || 0} active endpoints</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Live Polling Active (SWR)</span>
        </div>
      </div>

      {/* Provision Key Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowModal(false)} />
          <div className="relative bg-[#0a0a0e]/90 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-light text-white mb-2">Provision New Identity</h2>
            <p className="text-zinc-400 text-sm mb-8">Generate a cryptographic key and assign quota. Leave HWID empty to create a Claim Key.</p>
            <form onSubmit={handleGenerateKey} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Full Name</label>
                  <input type="text" value={clientData.name} onChange={(e) => setClientData({ ...clientData, name: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder-zinc-700 shadow-inner" placeholder="John Doe" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Phone</label>
                  <input type="text" value={clientData.phone} onChange={(e) => setClientData({ ...clientData, phone: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder-zinc-700 shadow-inner" placeholder="+880..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Email Identity</label>
                <input type="email" value={clientData.email} onChange={(e) => setClientData({ ...clientData, email: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder-zinc-700 shadow-inner" placeholder="john@enterprise.com" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Target Hardware ID (Optional — leave empty for Claim Key)</label>
                <input type="text" value={clientData.hwid} onChange={(e) => setClientData({ ...clientData, hwid: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder-zinc-700 shadow-inner" placeholder="Leave empty for claim key..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Assigned Tier</label>
                <select value={clientData.package_id} onChange={(e) => setClientData({ ...clientData, package_id: e.target.value })} className="w-full appearance-none bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner">
                  <option value="Annual Pass">Annual Pass (3000 tks)</option>
                  <option value="Monthly Pass">Monthly Pass (500 tks)</option>
                  <option value="Pro Pass">Pro Pass (1500 tks)</option>
                </select>
              </div>
              {generateError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-lg">{generateError}</div>}
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/[0.06]">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-zinc-400 hover:text-white font-medium rounded-xl hover:bg-white/[0.02] transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={isGenerating} className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 border border-cyan-400/30 text-white font-medium rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all text-sm disabled:opacity-50">
                  {isGenerating ? 'Generating Key...' : 'Authorize Execution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tune Plan & Tokens Modal */}
      {showTuneModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowTuneModal(false)} />
          <div className="relative bg-[#0a0a0e]/90 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-light text-white mb-2">🔧 Tune Client Configuration</h2>
            <p className="text-cyan-400 text-xs font-mono mb-6 bg-black/50 px-3 py-2 rounded-lg border border-white/5 truncate">HWID: {selectedClient.hwid}</p>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Plan Tier</label>
                <input type="text" value={tuneData.tier} onChange={(e) => setTuneData({ ...tuneData, tier: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Token Balance</label>
                <input type="text" value={tuneData.tokens_left} onChange={(e) => setTuneData({ ...tuneData, tokens_left: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-cyan-400 text-sm font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/[0.06]">
              <button onClick={() => setShowTuneModal(false)} className="px-5 py-2.5 text-zinc-400 hover:text-white font-medium rounded-xl hover:bg-white/[0.02] transition-colors text-sm">Cancel</button>
              <button onClick={handleTuneSave} disabled={isTuning} className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-medium rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all text-sm disabled:opacity-50">
                {isTuning ? 'Saving...' : '💾 Save & Overwrite Cloud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-[#0a0a0e]/90 backdrop-blur-2xl border border-red-500/20 rounded-2xl w-full max-w-sm shadow-[0_0_50px_rgba(239,68,68,0.1)] p-8 animate-in zoom-in-95 duration-200 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-light text-white mb-4">Revoke Client License?</h2>
            <p className="text-zinc-400 text-sm mb-2">This will permanently delete:</p>
            <p className="text-cyan-400 text-xs font-mono bg-black/50 px-3 py-2 rounded-lg border border-white/5 mb-6 truncate">{selectedClient.hwid}</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium py-2.5 rounded-xl transition-all text-sm disabled:opacity-50">
                {isDeleting ? 'Revoking...' : '❌ Confirm Revoke'}
              </button>
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 font-medium py-2.5 rounded-xl transition-all text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Key Success Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowClaimModal(false)} />
          <div className="relative bg-[#0a0a0e]/90 backdrop-blur-2xl border border-green-500/20 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(34,197,94,0.1)] p-8 animate-in zoom-in-95 duration-200 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-medium text-green-400 mb-6">VIP Provisioning Successful!</h2>
            <input type="text" readOnly value={claimLink} className="w-full bg-black/50 border border-cyan-500/30 rounded-xl px-4 py-3 text-cyan-400 text-sm font-mono text-center focus:outline-none shadow-[0_0_15px_rgba(34,211,238,0.1)]" />
            <button onClick={handleCopyClaimLink} className={`mt-4 w-full py-3 rounded-xl font-medium text-sm transition-all ${claimCopied ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200'}`}>
              {claimCopied ? '✔️ Copied to Clipboard' : '📋 Copy Activation Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
