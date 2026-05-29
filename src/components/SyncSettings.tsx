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
    <div className="bg-[#1E1E1E] rounded-xl p-5 border border-white/10 space-y-5">
      <div className="flex items-center gap-3">
        <div className="bg-white/5 p-2 rounded-lg text-primary">
          <Cloud size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Cloud Vault</h2>
          <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">Encrypted Sync</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Access Token</label>
          <input
            type="password"
            value={config.token}
            onChange={(e) => setConfig({ ...config, token: e.target.value })}
            placeholder="ghp_xxxxxxxxxxxx"
            className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Owner</label>
            <input
              type="text"
              value={config.owner}
              onChange={(e) => setConfig({ ...config, owner: e.target.value })}
              className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Repository</label>
            <input
              type="text"
              value={config.repo}
              onChange={(e) => setConfig({ ...config, repo: e.target.value })}
              className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">File Path</label>
          <input
            type="text"
            value={config.path}
            onChange={(e) => setConfig({ ...config, path: e.target.value })}
            className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-2 px-1 pt-1">
          <input
            type="checkbox"
            id="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-3.5 h-3.5 rounded bg-[#121212] border-white/10 text-primary focus:ring-primary focus:ring-offset-0"
          />
          <label htmlFor="remember" className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Remember credentials on this device</label>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-xs border ${
          status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span className="flex-1 font-medium">{status.message}</span>
          <button onClick={() => setStatus(null)}><X size={14} /></button>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-3 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-xs"
          >
            <Save size={14} /> Save Config
          </button>
          <button
            onClick={handleFullSync}
            disabled={loading}
            className="flex-[2] bg-primary text-[#121212] font-bold py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <><RefreshCw size={14} /> Pull Remote Data</>}
          </button>
        </div>
        <button
          onClick={handlePush}
          disabled={loading}
          className="w-full border border-white/10 text-zinc-300 font-bold py-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <>Push Local Changes</>}
        </button>
        <button
          onClick={handleWipe}
          disabled={loading}
          className="w-full mt-2 border border-rose-500/20 bg-rose-500/5 text-rose-400 font-bold py-3 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <><Trash2 size={14} /> Backup & Wipe Device</>}
        </button>
      </div>
    </div>
  );
};
