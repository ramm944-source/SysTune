'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetchApi } from '../lib/fetchApi';

const clientFetcher = async (url: string) => {
  const data = await fetchApi(url);
  return data.clients || [];
};

const landingFetcher = async (url: string) => {
  const data = await fetchApi(url);
  return data.config || { coupon: '', banner_text: '', active: false };
};

function Accordion({ title, icon, defaultOpen = false, children }: { title: string, icon: React.ReactNode, defaultOpen?: boolean, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.02] transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg opacity-80">{icon}</span>
          <span className="tracking-wide">{title}</span>
        </div>
        <span className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-6 pb-5 pt-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [quota, setQuota] = useState('3');
  const [revokeKey, setRevokeKey] = useState('');
  const [campaignGeo, setCampaignGeo] = useState('Global');
  const [campaignText, setCampaignText] = useState('');
  const [campaignActive, setCampaignActive] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'done' | 'error'>('idle');
  const [revokeStatus, setRevokeStatus] = useState<'idle' | 'revoking' | 'done' | 'error'>('idle');
  const [broadcastStatus, setBroadcastStatus] = useState<'idle' | 'broadcasting' | 'done' | 'error'>('idle');
  const [landingStatus, setLandingStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  // SWR: Live metrics from client data
  const { data: clients } = useSWR('/api/admin/bulk-clients', clientFetcher, { refreshInterval: 10000 });

  // SWR: Landing config
  const { data: landingConfig } = useSWR('/api/admin/landing-config', landingFetcher, { revalidateOnFocus: true });

  // Sync landing config state
  useEffect(() => {
    if (landingConfig) {
      setCouponCode(landingConfig.coupon || '');
      setBannerText(landingConfig.banner_text || '');
      setBannerActive(landingConfig.active || false);
    }
  }, [landingConfig]);

  // Compute live metrics
  const metrics = (() => {
    if (!clients || !Array.isArray(clients)) return { paid: 0, unclaimed: 0, free: 0 };
    let paid = 0, unclaimed = 0, free = 0;
    for (const c of clients) {
      const tier = (c.tier || c.package_id || 'free').toString().trim().toLowerCase();
      const hwid = (c.hwid || '').toString().toLowerCase();
      if (tier === 'free' || tier === '' || tier === 'unknown') {
        free++;
      } else if (hwid.startsWith('claim:')) {
        unclaimed++;
      } else {
        paid++;
      }
    }
    return { paid, unclaimed, free };
  })();

  const handlePushUpdate = async () => {
    setPushStatus('pushing');
    try {
      const res = await fetchApi('/api/admin/global-quota', {
        method: 'POST',
        body: JSON.stringify({ quota }),
      });
      setPushStatus('done');
      setTimeout(() => setPushStatus('idle'), 3000);
    } catch (err: any) {
      setPushStatus('error');
      alert(`Push failed: ${err.message}`);
      setTimeout(() => setPushStatus('idle'), 3000);
    }
  };

  const handleRevokeKey = async () => {
    if (!revokeKey.trim()) return;
    setRevokeStatus('revoking');
    try {
      await fetchApi('/api/admin/revoke-key', {
        method: 'POST',
        body: JSON.stringify({ hwid: revokeKey }),
      });
      setRevokeStatus('done');
      setRevokeKey('');
      setTimeout(() => setRevokeStatus('idle'), 3000);
    } catch (err: any) {
      setRevokeStatus('error');
      alert(`Revocation failed: ${err.message}`);
      setTimeout(() => setRevokeStatus('idle'), 3000);
    }
  };

  const handleBroadcastCampaign = async () => {
    setBroadcastStatus('broadcasting');
    try {
      await fetchApi('/api/admin/push-ad-campaign', {
        method: 'POST',
        body: JSON.stringify({
          target_region: campaignGeo,
          ad_text: campaignText,
          show_ad: campaignActive,
          expiry_hours: 48,
        }),
      });
      setBroadcastStatus('done');
      setTimeout(() => setBroadcastStatus('idle'), 3000);
    } catch (err: any) {
      setBroadcastStatus('error');
      alert(`Broadcast failed: ${err.message}`);
      setTimeout(() => setBroadcastStatus('idle'), 3000);
    }
  };

  const handlePushLanding = async () => {
    setLandingStatus('saving');
    try {
      await fetchApi('/api/admin/landing-config', {
        method: 'POST',
        body: JSON.stringify({ coupon: couponCode, banner_text: bannerText, active: bannerActive }),
      });
      setLandingStatus('done');
      setTimeout(() => setLandingStatus('idle'), 3000);
    } catch (err: any) {
      setLandingStatus('error');
      alert(`Landing config save failed: ${err.message}`);
      setTimeout(() => setLandingStatus('idle'), 3000);
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 md:sticky md:top-0 md:h-screen w-80 flex flex-col bg-[#08080c] md:bg-black/40 backdrop-blur-3xl border-r border-white/[0.08] shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-40 shrink-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 overflow-hidden`}>

      {/* Brand Header */}
      <div className="px-6 py-8 border-b border-white/[0.04] bg-gradient-to-b from-white/[0.02] to-transparent flex justify-between items-center">
        <div>
          <h2 className="text-xs font-semibold text-indigo-400 tracking-[0.2em] uppercase mb-1">Control Plane</h2>
          <h1 className="text-xl font-light text-zinc-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
            SysTune <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Enterprise</span>
          </h1>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-white md:hidden focus:outline-none"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* Live Metrics — Dynamically Computed */}
        <Accordion title="Live Network Metrics" icon="📊" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-cyan-500/5 to-cyan-500/[0.01] border border-cyan-500/10 rounded-xl p-4 flex flex-col justify-between h-24 transition-all hover:border-cyan-500/20 shadow-lg">
              <span className="text-[10px] font-semibold text-cyan-400/80 uppercase tracking-wider">Paid Nodes</span>
              <span className="text-3xl font-semibold text-cyan-400 font-mono tracking-tight">{metrics.paid}</span>
            </div>
            <div className="bg-gradient-to-br from-indigo-500/5 to-indigo-500/[0.01] border border-indigo-500/10 rounded-xl p-4 flex flex-col justify-between h-24 transition-all hover:border-indigo-500/20 shadow-lg">
              <span className="text-[10px] font-semibold text-indigo-400/80 uppercase tracking-wider">Unclaimed</span>
              <span className="text-3xl font-semibold text-indigo-400 font-mono tracking-tight">{metrics.unclaimed}</span>
            </div>
            <div className="bg-gradient-to-br from-zinc-500/5 to-zinc-500/[0.01] border border-zinc-500/10 rounded-xl p-4 flex flex-col justify-between h-24 transition-all hover:border-zinc-500/20 shadow-lg col-span-2">
              <div className="flex justify-between items-center w-full">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Free / Total</span>
                <span className="text-xs text-zinc-500 font-mono">{metrics.free} / {clients?.length || 0}</span>
              </div>
              <span className="text-2xl font-semibold text-zinc-300 font-mono tracking-tight">{metrics.free} <span className="text-xs text-zinc-500 font-normal">nodes</span></span>
            </div>
          </div>
        </Accordion>

        {/* Global Cloud Config — Wired to API */}
        <Accordion title="Global Cloud Config" icon="☁️">
          <div>
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Global Free Quota</label>
            <input
              type="text"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-cyan-400 font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-zinc-600 shadow-inner"
            />
          </div>
          <button
            onClick={handlePushUpdate}
            disabled={pushStatus === 'pushing'}
            className={`w-full text-sm font-medium py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(0,0,0,0.2)] flex items-center justify-center gap-2 ${
              pushStatus === 'done' ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
              pushStatus === 'error' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
              'bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-cyan-500/50 text-zinc-200 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]'
            }`}
          >
            {pushStatus === 'pushing' ? '🔄 Pushing to All Nodes...' :
             pushStatus === 'done' ? '✔️ Synced & Distributed' :
             pushStatus === 'error' ? '❌ Failed' :
             '💾 Push Remote Updates'}
          </button>
        </Accordion>

        {/* Access Revocation — Wired to API */}
        <Accordion title="Access Revocation" icon="🛡️">
          <div>
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Target HWID / Token</label>
            <input
              type="text"
              value={revokeKey}
              onChange={(e) => setRevokeKey(e.target.value)}
              placeholder="e.g. e482a56..."
              className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-200 font-mono text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all placeholder-zinc-700 shadow-inner"
            />
          </div>
          <button
            onClick={handleRevokeKey}
            disabled={revokeStatus === 'revoking'}
            className={`w-full text-sm font-medium py-2 rounded-lg transition-all ${
              revokeStatus === 'done' ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
              revokeStatus === 'error' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
              'bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]'
            }`}
          >
            {revokeStatus === 'revoking' ? '🔄 Revoking...' :
             revokeStatus === 'done' ? '✔️ Key Blacklisted' :
             '🚫 Execute Revocation'}
          </button>
        </Accordion>

        {/* Live Ad Designer — Already Wired */}
        <Accordion title="Live Ad Designer" icon="📢">
          <div>
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Target Region</label>
            <div className="relative">
              <select
                value={campaignGeo}
                onChange={(e) => setCampaignGeo(e.target.value)}
                className="w-full appearance-none bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              >
                <option value="Global">Global Workspace</option>
                <option value="BD">BD (Bangladesh)</option>
                <option value="CN">CN (China)</option>
                <option value="US">US (USA)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Promotion Copy</label>
            <textarea
              value={campaignText}
              onChange={(e) => setCampaignText(e.target.value)}
              placeholder="Inject promotion text..."
              className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-300 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all h-20 resize-none placeholder-zinc-700 shadow-inner"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-white/[0.02] rounded-lg transition-colors border border-transparent hover:border-white/[0.04]">
            <div className="relative flex items-center">
              <input type="checkbox" checked={campaignActive} onChange={(e) => setCampaignActive(e.target.checked)} className="peer sr-only" />
              <div className="w-8 h-4 bg-zinc-800 rounded-full peer peer-checked:bg-indigo-500 transition-colors border border-white/10"></div>
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-zinc-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all"></div>
            </div>
            <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Broadcast Alert</span>
          </label>
          <button
            onClick={handleBroadcastCampaign}
            disabled={broadcastStatus === 'broadcasting'}
            className={`w-full text-sm font-medium py-2 rounded-lg transition-all mt-2 ${
              broadcastStatus === 'done' ? 'bg-green-500/20 border border-green-500/30 text-green-400 shadow-none' :
              'bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]'
            }`}
          >
            {broadcastStatus === 'broadcasting' ? '🔄 Broadcasting...' :
             broadcastStatus === 'done' ? '✔️ Campaign Live!' :
             '🚀 Deploy Campaign'}
          </button>
        </Accordion>

        {/* Landing Page Promo Config — NEW */}
        <Accordion title="Landing Page Promo" icon="🛍️">
          <div>
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Coupon Code</label>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="e.g. SYSTUNE50"
              className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-amber-400 font-mono text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-zinc-700 shadow-inner"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Promo Banner Text</label>
            <input
              type="text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              placeholder="🔥 50% OFF limited time!"
              className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder-zinc-700 shadow-inner"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-white/[0.02] rounded-lg transition-colors border border-transparent hover:border-white/[0.04]">
            <div className="relative flex items-center">
              <input type="checkbox" checked={bannerActive} onChange={(e) => setBannerActive(e.target.checked)} className="peer sr-only" />
              <div className="w-8 h-4 bg-zinc-800 rounded-full peer peer-checked:bg-amber-500 transition-colors border border-white/10"></div>
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-zinc-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all"></div>
            </div>
            <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Activate Promo</span>
          </label>
          <button
            onClick={handlePushLanding}
            disabled={landingStatus === 'saving'}
            className={`w-full text-sm font-medium py-2 rounded-lg transition-all ${
              landingStatus === 'done' ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
              'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]'
            }`}
          >
            {landingStatus === 'saving' ? '🔄 Saving...' :
             landingStatus === 'done' ? '✔️ Config Saved!' :
             '💾 Push Promo Settings'}
          </button>
        </Accordion>

      </div>
    </aside>
  );
}
