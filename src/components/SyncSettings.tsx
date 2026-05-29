import React, { useState, useEffect } from 'react';
import { getStoredConfig, saveConfig, type GithubConfig } from '../services/githubSync';
import { syncDatabase, syncPush } from '../db/syncController';
import { Save, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Cloud, X } from 'lucide-react';

export const SyncSettings: React.FC = () => {
  const [config, setConfig] = useState<GithubConfig>({
    token: '',
    owner: '',
    repo: '',
    path: 'data.json'
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const stored = getStoredConfig();
    if (stored) setConfig(stored);
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setStatus({ type: 'success', message: 'Settings saved locally.' });
  };

  const handleFullSync = async () => {
    setLoading(true);
    setStatus(null);
    try {
      saveConfig(config);
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
      await syncPush();
      setStatus({ type: 'success', message: 'Pushed to GitHub.' });
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Push failed.' });
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
      </div>
    </div>
  );
};
