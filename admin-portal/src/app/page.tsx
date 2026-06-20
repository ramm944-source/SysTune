'use client';
import { useState } from 'react';
import { SWRConfig } from 'swr';
import { fetchApi } from '../lib/fetchApi';
import Sidebar from '../components/Sidebar';
import ClientDirectory from '../components/ClientDirectory';
import PendingOrders from '../components/PendingOrders';
import PackageCMS from '../components/PackageCMS';
import GlobalConfig from '../components/GlobalConfig';
import BlogManager from '../components/BlogManager';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('clients');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('systune_admin_token');
      await fetchApi('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API failed:', err);
    }
    window.location.href = '/login';
  };

  return (
    <SWRConfig 
      value={{
        onError: (err) => {
          if (err && (err.message?.includes('Unauthorized') || err.message?.includes('401'))) {
            setSessionExpired(true);
          }
        }
      }}
    >
      <main className="min-h-screen bg-[#050507] text-white flex font-sans selection:bg-cyan-500/30 relative">
        {/* Mobile Drawer Backdrop */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-30 md:hidden"
          />
        )}

        {/* Persistent Left Sidebar (Togglable on Mobile) */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col min-h-screen relative min-w-0 overflow-y-auto">
          {/* Background gradient orb */}
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

          {/* Top Header */}
          <header className="flex justify-between items-center md:items-end px-6 md:px-8 pt-6 md:pt-8 pb-4 border-b border-white/[0.04] bg-transparent z-10 gap-4">
            <div className="flex items-center gap-3 w-full min-w-0">
              {/* Hamburger Button for Mobile */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 text-zinc-400 hover:text-white bg-white/[0.02] border border-white/5 rounded-lg focus:outline-none transition-colors shrink-0"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              </button>
              
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hidden md:inline">Global Navigation</span>
                <div className="flex gap-6 md:gap-8 border-b border-transparent overflow-x-auto no-scrollbar scroll-smooth pb-1 md:pb-0">
                  {/* Tab Navigators */}
                  <button
                    onClick={() => setActiveTab('clients')}
                    className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${activeTab === 'clients' ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    📋 Client Directory
                    {activeTab === 'clients' && <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"></span>}
                  </button>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${activeTab === 'orders' ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    📥 Pending Orders
                    {activeTab === 'orders' && <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>}
                  </button>
                  <button
                    onClick={() => setActiveTab('packages')}
                    className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${activeTab === 'packages' ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    📦 Package CMS
                    {activeTab === 'packages' && <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"></span>}
                  </button>
                  <button
                    onClick={() => setActiveTab('config')}
                    className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${activeTab === 'config' ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    ⚙️ Global Config
                    {activeTab === 'config' && <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"></span>}
                  </button>
                  <button
                    onClick={() => setActiveTab('blog')}
                    className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${activeTab === 'blog' ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    📰 AI Blog Manager
                    {activeTab === 'blog' && <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 md:gap-4 shrink-0 pb-1 md:pb-3">
              {/* SWR Active Polling Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full text-[10px] text-cyan-400 font-mono tracking-wider font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-glow"></span>
                ACTIVE SYNC
              </div>

              {/* Logout Button */}
              <button 
                onClick={handleLogout}
                className="px-2.5 md:px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/45 text-red-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 focus:outline-none shadow-[0_0_15px_rgba(239,68,68,0.05)] cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                <span className="hidden xs:inline">Logout</span>
              </button>

              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-white/20">
                A
              </div>
            </div>
          </header>

          {/* Tab Content Area (Flex container to allow natural expansion and page-level scrolling) */}
          <div className="flex-1 flex flex-col relative z-10 overflow-visible">
            {activeTab === 'clients' && <ClientDirectory />}
            {activeTab === 'orders' && <PendingOrders />}
            {activeTab === 'packages' && <PackageCMS />}
            {activeTab === 'config' && <GlobalConfig />}
            {activeTab === 'blog' && <BlogManager />}
          </div>
        </div>

      </main>

      {/* Session Expired Overlay */}
      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative bg-[#0a0a0e]/95 border border-red-500/25 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(239,68,68,0.15)] p-8 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-3xl text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              ⚠️
            </div>
            <h2 className="text-2xl font-light text-white mb-3 tracking-tight">Session Expired</h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              Your zero-trust administrative session has expired or is invalid. Please re-authenticate to restore secure access to the Control Plane.
            </p>
            <button 
              onClick={() => window.location.href = '/login'}
              className="w-full bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-400 hover:to-amber-500 text-white font-medium py-3.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all text-sm font-semibold cursor-pointer focus:outline-none"
            >
              Re-authenticate Securely
            </button>
          </div>
        </div>
      )}
    </SWRConfig>
  );
}
