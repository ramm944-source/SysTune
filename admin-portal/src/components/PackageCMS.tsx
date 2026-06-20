'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetchApi } from '../lib/fetchApi';

const fetcher = async (url: string) => {
  const data = await fetchApi(url);
  return Array.isArray(data) ? data : [];
};

export default function PackageCMS() {
  const { data: catalog, error, isLoading, mutate } = useSWR('/api/admin/pricing-crud', fetcher, { revalidateOnFocus: true });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedPkg, setEditedPkg] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPkg, setNewPkg] = useState({ name: '', badge: '', main_price_bdt: '', offer_price_bdt: '', main_price_usd: '', offer_price_usd: '', tokens: '', max_seats: '1', features: '' });

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const handleEditStart = (pkg: any, idx: number) => { setEditingIndex(idx); setEditedPkg({ ...pkg }); };

  const handleSave = async () => {
    if (!catalog || editingIndex === null || !editedPkg) return;
    setIsSaving(true);
    const newCatalog = [...catalog];
    newCatalog[editingIndex] = editedPkg;
    try {
      await fetchApi('/api/admin/pricing-crud', { method: 'PUT', body: JSON.stringify(newCatalog) });
      mutate(newCatalog, false);
      setEditingIndex(null); setEditedPkg(null);
    } catch (err: any) { alert(`Save failed: ${err.message}`); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (idx: number) => {
    if (!catalog || !confirm('Permanently delete this package offer?')) return;
    const newCatalog = catalog.filter((_: any, i: number) => i !== idx);
    try {
      await fetchApi('/api/admin/pricing-crud', { method: 'PUT', body: JSON.stringify(newCatalog) });
      mutate(newCatalog, false);
    } catch (err: any) { alert(`Delete failed: ${err.message}`); }
  };

  const handleAddPackage = async () => {
    const slug = autoSlug(newPkg.name);
    if (!slug || !newPkg.name || !newPkg.offer_price_bdt || !newPkg.tokens) return;
    const pkg = {
      id: slug, name: newPkg.name, badge: newPkg.badge,
      main_price_bdt: parseInt(newPkg.main_price_bdt) || '',
      offer_price_bdt: parseInt(newPkg.offer_price_bdt) || 0,
      main_price_usd: newPkg.main_price_usd, offer_price_usd: newPkg.offer_price_usd,
      tokens: parseInt(newPkg.tokens) || 0, max_seats: parseInt(newPkg.max_seats) || 1,
      features: newPkg.features, price: parseInt(newPkg.offer_price_bdt) || 0, usd_price: newPkg.offer_price_usd
    };
    const newCatalog = [...(catalog || []), pkg];
    try {
      await fetchApi('/api/admin/pricing-crud', { method: 'PUT', body: JSON.stringify(newCatalog) });
      mutate(newCatalog, false);
      setShowAddModal(false);
      setNewPkg({ name: '', badge: '', main_price_bdt: '', offer_price_bdt: '', main_price_usd: '', offer_price_usd: '', tokens: '', max_seats: '1', features: '' });
    } catch (err: any) { alert(`Add failed: ${err.message}`); }
  };

  return (
    <div className="flex flex-col p-4 sm:p-8 lg:p-12 animate-in fade-in duration-700 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight flex items-center gap-3">
            <span className="text-3xl sm:text-4xl text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">📦</span>
            Package CMS Matrix
          </h1>
          <p className="text-zinc-500 mt-2 text-xs sm:text-sm max-w-xl leading-relaxed">
            Dynamically adjust pricing, token allocation, and seat limits. Changes propagate instantly to live payment gateways.
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-500/90 to-indigo-600/90 hover:from-cyan-400 hover:to-indigo-500 border border-cyan-400/30 text-white font-medium rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Add New Offer Pack
        </button>
      </div>

      {error && <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl"><span className="text-sm font-medium">Failed to load catalog: {error.message}</span></div>}

      {/* Full 10-Column Grid */}
      <div className="bg-black/40 backdrop-blur-2xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">ID</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Badge</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Main ৳</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Offer ৳</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Main $</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Offer $</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tokens</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Seats</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Features</th>
                <th className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading && !catalog ? (
                <tr><td colSpan={11} className="px-6 py-12 text-center text-zinc-500 text-sm">Loading Pricing Matrix...</td></tr>
              ) : catalog?.map((pkg: any, idx: number) => {
                const isEditing = editingIndex === idx;
                const inputCls = "bg-black/50 border border-indigo-500/50 rounded px-2 py-1 text-white text-sm w-full focus:outline-none";
                return (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-zinc-500">{pkg.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input value={editedPkg.name} onChange={(e) => setEditedPkg({ ...editedPkg, name: e.target.value })} className={inputCls} /> : <span className="text-sm font-medium text-cyan-400">{pkg.name}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input value={editedPkg.badge || ''} onChange={(e) => setEditedPkg({ ...editedPkg, badge: e.target.value })} className={inputCls} /> : <span className="text-xs text-purple-400">{pkg.badge || '—'}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input type="number" value={editedPkg.main_price_bdt || ''} onChange={(e) => setEditedPkg({ ...editedPkg, main_price_bdt: e.target.value })} className={`${inputCls} w-20`} /> : <span className="text-sm text-zinc-500 line-through">{pkg.main_price_bdt ? `৳${pkg.main_price_bdt}` : '—'}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input type="number" value={editedPkg.offer_price_bdt || editedPkg.price} onChange={(e) => setEditedPkg({ ...editedPkg, offer_price_bdt: parseInt(e.target.value) || 0, price: parseInt(e.target.value) || 0 })} className={`${inputCls} w-20`} /> : <span className="text-sm text-zinc-300 font-medium">৳{pkg.offer_price_bdt || pkg.price}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input value={editedPkg.main_price_usd || ''} onChange={(e) => setEditedPkg({ ...editedPkg, main_price_usd: e.target.value })} className={`${inputCls} w-20`} /> : <span className="text-sm text-zinc-500 line-through">{pkg.main_price_usd ? `$${pkg.main_price_usd}` : '—'}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input value={editedPkg.offer_price_usd || editedPkg.usd_price || ''} onChange={(e) => setEditedPkg({ ...editedPkg, offer_price_usd: e.target.value, usd_price: e.target.value })} className={`${inputCls} w-20`} /> : <span className="text-sm text-zinc-300">{pkg.offer_price_usd || pkg.usd_price ? `$${pkg.offer_price_usd || pkg.usd_price}` : '—'}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input type="number" value={editedPkg.tokens} onChange={(e) => setEditedPkg({ ...editedPkg, tokens: parseInt(e.target.value) || 0 })} className={`${inputCls} w-20 font-mono`} /> : <span className="text-sm text-indigo-400 font-mono">{pkg.tokens}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{isEditing ? <input type="number" value={editedPkg.max_seats} onChange={(e) => setEditedPkg({ ...editedPkg, max_seats: parseInt(e.target.value) || 1 })} className={`${inputCls} w-16`} /> : <span className="text-sm text-zinc-400">{pkg.max_seats === 999 ? 'Unlimited' : `${pkg.max_seats} PC`}</span>}</td>
                    <td className="px-4 py-3">{isEditing ? <input value={editedPkg.features} onChange={(e) => setEditedPkg({ ...editedPkg, features: e.target.value })} className={inputCls} /> : <span className="text-xs text-zinc-500 truncate max-w-[150px] inline-block">{pkg.features}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {isEditing ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={handleSave} disabled={isSaving} className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded hover:bg-green-500/30 transition-colors">{isSaving ? '...' : 'Save'}</button>
                          <button onClick={() => setEditingIndex(null)} className="text-xs bg-white/5 text-zinc-400 px-3 py-1 rounded hover:bg-white/10 transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditStart(pkg, idx)} className="text-xs bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">Edit</button>
                          <button onClick={() => handleDelete(idx)} className="text-xs bg-red-500/10 text-red-400 px-3 py-1 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors">❌</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Package Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-[#0a0a0e]/90 backdrop-blur-2xl border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-light text-white mb-2">➕ Create Pack Offer</h2>
            <p className="text-zinc-400 text-sm mb-6">Auto-generated slug: <span className="text-cyan-400 font-mono">{autoSlug(newPkg.name) || '...'}</span></p>
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Display Name</label><input value={newPkg.name} onChange={(e) => setNewPkg({ ...newPkg, name: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500/50 transition-all" placeholder="e.g. Starter Pack" /></div>
              <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Badge (Optional)</label><input value={newPkg.badge} onChange={(e) => setNewPkg({ ...newPkg, badge: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-purple-400 text-sm focus:outline-none focus:border-purple-500/50 transition-all" placeholder="e.g. Best Value" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Main ৳ BDT</label><input value={newPkg.main_price_bdt} onChange={(e) => setNewPkg({ ...newPkg, main_price_bdt: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono focus:outline-none transition-all" placeholder="600" /></div>
                <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Offer ৳ BDT</label><input value={newPkg.offer_price_bdt} onChange={(e) => setNewPkg({ ...newPkg, offer_price_bdt: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-cyan-400 text-sm font-mono focus:outline-none transition-all" placeholder="399" /></div>
                <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Main $ USD</label><input value={newPkg.main_price_usd} onChange={(e) => setNewPkg({ ...newPkg, main_price_usd: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono focus:outline-none transition-all" placeholder="6.99" /></div>
                <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Offer $ USD</label><input value={newPkg.offer_price_usd} onChange={(e) => setNewPkg({ ...newPkg, offer_price_usd: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-cyan-400 text-sm font-mono focus:outline-none transition-all" placeholder="4.99" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Token Quota</label><input value={newPkg.tokens} onChange={(e) => setNewPkg({ ...newPkg, tokens: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-green-400 text-sm font-mono focus:outline-none transition-all" placeholder="100" /></div>
                <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Max Seats</label><input value={newPkg.max_seats} onChange={(e) => setNewPkg({ ...newPkg, max_seats: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none transition-all" placeholder="1" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Features / Description</label><input value={newPkg.features} onChange={(e) => setNewPkg({ ...newPkg, features: e.target.value })} className="w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none transition-all" placeholder="100 Fixes, Basic Tweaks" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/[0.06]">
              <button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-zinc-400 hover:text-white font-medium rounded-xl hover:bg-white/[0.02] transition-colors text-sm">Cancel</button>
              <button onClick={handleAddPackage} className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-medium rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all text-sm">🚀 Provision Offer Pack</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
