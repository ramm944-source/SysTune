'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { fetchApi } from '../lib/fetchApi';

const fetcher = async (url: string) => {
  const data = await fetchApi(url);
  return data.config || {};
};

export default function GlobalConfig() {
  const { data: config, error, isLoading, mutate } = useSWR('/api/admin/config', fetcher, { revalidateOnFocus: true });
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'mail' | 'payment'>('mail');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [faviconStatus, setFaviconStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  const handleChange = (key: string, value: string | boolean) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetchApi('/api/admin/config', { method: 'POST', body: JSON.stringify(formData) });
      mutate(formData, false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      alert(`Save failed: ${err.message}`);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFormData({ ...formData, favicon_url: result });
      setFaviconStatus(`${file.name} loaded`);
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'mail' as const, label: '📧 Mail & AI Services' },
    { id: 'payment' as const, label: '💳 Payment & Updater' },
  ];

  const inputCls = "w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder-zinc-700 shadow-inner";
  const passwordCls = "w-full bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder-zinc-700 shadow-inner";

  return (
    <div className="flex flex-col p-4 sm:p-8 lg:p-12 animate-in fade-in duration-700 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-zinc-100 tracking-tight flex items-center gap-3">
            <span className="text-3xl sm:text-4xl text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">⚙️</span>
            Global Config Matrix
          </h1>
          <p className="text-zinc-500 mt-2 text-xs sm:text-sm max-w-xl leading-relaxed">Central command for SMTP, AI, Payment Gateways, and Cloud Updater configurations.</p>
        </div>
      </div>

      {error && <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl text-sm">Config fetch error: {error.message}</div>}

      <div className="bg-black/40 backdrop-blur-2xl border border-white/[0.06] rounded-2xl shadow-2xl flex flex-col">
        {/* Sub-Tab Navigation */}
        <div className="flex border-b border-white/[0.06]">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all ${activeTab === tab.id ? 'text-white bg-white/[0.04] border-b-2 border-cyan-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-8">
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500">Loading configurations...</div>
          ) : activeTab === 'mail' ? (
            <div className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">SMTP Server Host</label>
                  <input value={formData.smtp_server || ''} onChange={(e) => handleChange('smtp_server', e.target.value)} className={inputCls} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">SMTP Port Number</label>
                  <input value={formData.smtp_port || ''} onChange={(e) => handleChange('smtp_port', e.target.value)} className={inputCls} placeholder="587" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sender Email</label>
                <input value={formData.sender_email || formData.smtp_user || ''} onChange={(e) => handleChange('sender_email', e.target.value)} className={inputCls} placeholder="billing@systune.app" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Secure App Password</label>
                <input type="password" value={formData.sender_password || formData.smtp_pass || ''} onChange={(e) => handleChange('sender_password', e.target.value)} className={passwordCls} placeholder="••••••••" />
              </div>
              <hr className="border-white/[0.04]" />
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Gemini API Key</label>
                <input type="password" value={formData.gemini_api_key || formData.gemini_key || ''} onChange={(e) => handleChange('gemini_api_key', e.target.value)} className={passwordCls} placeholder="AIza..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Target Gemini Model</label>
                <input value={formData.gemini_model || ''} onChange={(e) => handleChange('gemini_model', e.target.value)} className={inputCls} placeholder="gemini-3.5-flash" />
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Stripe Publishable Key</label>
                <input value={formData.stripe_pk || ''} onChange={(e) => handleChange('stripe_pk', e.target.value)} className={inputCls} placeholder="pk_live_..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Stripe Secret Key</label>
                <input type="password" value={formData.stripe_sk || formData.stripe_key || ''} onChange={(e) => handleChange('stripe_sk', e.target.value)} className={passwordCls} placeholder="sk_live_..." />
              </div>
              <hr className="border-white/[0.04]" />
              <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em]">Cloud Auto-Updater Matrix</h3>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Latest Prod Build Version</label>
                <input value={formData.latest_app_version || ''} onChange={(e) => handleChange('latest_app_version', e.target.value)} className={inputCls} placeholder="e.g. 3.2.1" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Global Setup Download URL</label>
                <input value={formData.app_download_url || ''} onChange={(e) => handleChange('app_download_url', e.target.value)} className={inputCls} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Legacy Setup Download URL (Win 7/8)</label>
                <input value={formData.legacy_setup_url || ''} onChange={(e) => handleChange('legacy_setup_url', e.target.value)} className={inputCls} placeholder="https://..." />
              </div>
              <hr className="border-white/[0.04]" />
              {/* Favicon Upload */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Upload Global Favicon (PNG/ICO)</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input ref={fileInputRef} type="file" accept=".png,.ico" onChange={handleFaviconUpload} className="hidden" />
                  <div className="flex-1 bg-black/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-500 truncate">
                    {faviconStatus || (formData.favicon_url ? 'Favicon data present ✓' : 'No file chosen')}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm rounded-xl hover:bg-cyan-500/20 transition-colors cursor-pointer text-center">Browse...</button>
                </div>
              </div>
              <hr className="border-white/[0.04]" />
              {/* Ecosystem Toggles */}
              <label className="flex items-center gap-3 cursor-pointer group p-3 hover:bg-white/[0.02] rounded-xl transition-colors border border-transparent hover:border-white/[0.04]">
                <div className="relative flex items-center">
                  <input type="checkbox" checked={formData.enable_local !== false} onChange={(e) => handleChange('enable_local', e.target.checked)} className="peer sr-only" />
                  <div className="w-8 h-4 bg-zinc-800 rounded-full peer peer-checked:bg-cyan-500 transition-colors border border-white/10"></div>
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-zinc-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all"></div>
                </div>
                <span className="text-sm font-medium text-zinc-300">Enable Local Manual Payments</span>
              </label>
              <div>
                <label className="block text-xs font-semibold text-pink-400 uppercase tracking-wider mb-3">Global Ecosystem Mode</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer p-4 rounded-xl border transition-all ${formData.ecosystem_mode !== 'PREMIUM' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/10'}`}>
                    <input type="radio" name="ecosystem" checked={formData.ecosystem_mode !== 'PREMIUM'} onChange={() => handleChange('ecosystem_mode', 'FREE')} className="sr-only" />
                    <span className="text-lg">🟢</span>
                    <span className="text-sm font-medium">Free Private Beta</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer p-4 rounded-xl border transition-all ${formData.ecosystem_mode === 'PREMIUM' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/10'}`}>
                    <input type="radio" name="ecosystem" checked={formData.ecosystem_mode === 'PREMIUM'} onChange={() => handleChange('ecosystem_mode', 'PREMIUM')} className="sr-only" />
                    <span className="text-lg">⚡</span>
                    <span className="text-sm font-medium">Premium Live Mode</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-8 py-6 border-t border-white/[0.04] bg-white/[0.01]">
          <button onClick={handleSave} disabled={isSaving} className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
            saveStatus === 'saved' ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
            saveStatus === 'error' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
            'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 border border-cyan-400/30 text-white shadow-[0_0_20px_rgba(34,211,238,0.2)]'
          }`}>
            {isSaving ? '🔄 Saving to Central Server...' :
             saveStatus === 'saved' ? '✔️ System Matrix Updated & Synced' :
             '💾 Save Central Server Configurations'}
          </button>
        </div>
      </div>
    </div>
  );
}
