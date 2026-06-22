import React, { useState, useEffect } from 'react';
import { getStoredConfig, saveConfig, clearConfig, setRuntimeConfig, type GithubConfig } from '../services/githubSync';
import { syncDatabase, syncPush } from '../db/syncController';
import { db } from '../db/db';
import { Save, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Cloud, X, Trash2 } from 'lucide-react';

export const SyncSettings: React.FC = () => {
  const [config, setConfig] = useState<GithubConfig>({
    token: '',
    owner: '',
    repo: '',
    path: 'data.json'
  });

  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const stored = getStoredConfig();
    if (stored) {
      setConfig(stored);
      setRemember(true);
    } else {
      setRemember(false);
    }
  }, []);

  const applyConfig = () => {
    setRuntimeConfig(config);
    if (remember) {
      saveConfig(config);
    } else {
      clearConfig();
    }
  };

  const handleSave = () => {
    applyConfig();
    setStatus({ type: 'success', message: remember ? 'Settings saved to device.' : 'Settings applied for this session only.' });
  };

  const handleFullSync = async () => {
    if (!window.confirm("⚠️ CRITICAL WARNING: Downloading cloud data will completely OVERWRITE and REPLACE all transactions, budgets, and savings on this device! Any unsaved local changes will be permanently deleted. Continue?")) return;
    setLoading(true);
    setStatus(null);
    try {
      applyConfig();
      await syncDatabase();
      setStatus({ type: 'success', message: 'Full sync complete.' });
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Sync failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!window.confirm("📤 Confirm Upload: This will copy all transactions, budgets, and savings from this device to your GitHub cloud repository. Continue?")) return;
    setLoading(true);
    setStatus(null);
    try {
      applyConfig();
      await syncPush();
      setStatus({ type: 'success', message: 'Pushed to GitHub.' });
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Push failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleWipe = async () => {
    if (!window.confirm("WARNING: This will backup your data to GitHub and completely WIPE this device's records. Continue?")) return;
    setLoading(true);
    setStatus(null);
    try {
      applyConfig();
      await syncPush();
      await db.transactions.clear();
      setStatus({ type: 'success', message: 'Backup successful. Device data wiped.' });
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Backup failed. Device wipe aborted to prevent data loss.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Access Token</label>
          <input
            type="password"
            value={config.token}
            onChange={(e) => setConfig({ ...config, token: e.target.value })}
            placeholder="ghp_xxxxxxxxxxxx"
            className="w-full premium-input font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Owner</label>
            <input
              type="text"
              value={config.owner}
              onChange={(e) => setConfig({ ...config, owner: e.target.value })}
              className="w-full premium-input text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Repository</label>
            <input
              type="text"
              value={config.repo}
              onChange={(e) => setConfig({ ...config, repo: e.target.value })}
              className="w-full premium-input text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">File Path</label>
          <input
            type="text"
            value={config.path}
            onChange={(e) => setConfig({ ...config, path: e.target.value })}
            className="w-full premium-input font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 px-1 pt-1">
          <input
            type="checkbox"
            id="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded bg-black/40 border-white/10 text-violet-500 focus:ring-violet-500/20 focus:ring-offset-0 transition-colors"
          />
          <label htmlFor="remember" className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider select-none cursor-pointer">
            Remember credentials on this device
          </label>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-xs border ${
          status.type === 'success' 
            ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' 
            : 'bg-rose-500/5 text-rose-400 border-rose-500/10'
        }`}>
          {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span className="flex-1 font-semibold leading-snug">{status.message}</span>
          <button onClick={() => setStatus(null)} className="text-zinc-400 hover:text-zinc-200 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 text-zinc-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer btn-pop"
          >
            <Save size={14} /> Save Config
          </button>
          <button
            onClick={handleFullSync}
            disabled={loading}
            className="flex-[2] border border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer text-center btn-pop"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <><RefreshCw size={14} /> Download Cloud Data</>}
          </button>
        </div>
        
        <button
          onClick={handlePush}
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer shadow-lg shadow-violet-600/15 hover:shadow-violet-600/25 btn-pop"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <><Cloud size={15} /> Upload Device Data to Cloud</>}
        </button>
        
        <button
          onClick={handleWipe}
          disabled={loading}
          className="w-full border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer btn-pop"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <><Trash2 size={15} /> Backup & Wipe Device</>}
        </button>
      </div>
    </div>
  );
};
