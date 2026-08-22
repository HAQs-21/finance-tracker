import React, { useState, useEffect, useMemo } from 'react';
import { 
  Cloud, 
  RefreshCw, 
  FileText, 
  FileDown, 
  Clipboard, 
  Check, 
  Trash2, 
  Save, 
  ArrowRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { SegmentedControl } from './ui/SegmentedControl';
import { Button } from './ui/Button';
import { 
  getStoredConfig, 
  saveConfig, 
  clearConfig, 
  setRuntimeConfig, 
  type GithubConfig 
} from '../services/githubSync';
import { syncDatabase, syncPush } from '../db/syncController';
import { db } from '../db/db';
import { parseTextToPreview } from '../db/bulkImport';
import { exportTransactionsToText } from '../utils/bulkExport';
import { formatCurrency } from '../db/financeUtils';
import { useToast } from '../context/ToastContext';
import type { Transaction } from '../types';

interface ToolsViewProps {
  transactions: Transaction[];
  onFinishImport?: () => void;
}

type ToolSection = 'sync' | 'import' | 'export';

export const ToolsView: React.FC<ToolsViewProps> = ({ transactions, onFinishImport }) => {
  const { showToast } = useToast();
  const [section, setSection] = useState<ToolSection>('sync');

  // --- SYNC STATE ---
  const [ghConfig, setGhConfig] = useState<GithubConfig>({
    token: '',
    owner: '',
    repo: '',
    path: 'data.json'
  });
  const [remember, setRemember] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    const stored = getStoredConfig();
    if (stored) {
      setGhConfig(stored);
      setRemember(true);
    } else {
      setRemember(false);
    }
  }, []);

  const applyConfig = () => {
    setRuntimeConfig(ghConfig);
    if (remember) saveConfig(ghConfig);
    else clearConfig();
  };

  const handleSaveConfig = () => {
    applyConfig();
    showToast(remember ? 'Settings saved to device' : 'Settings applied for this session', 'success');
  };

  const handleDownloadCloud = async () => {
    if (!window.confirm('Download and OVERWRITE local records with cloud data? Unsaved device records will be replaced.')) {
      return;
    }
    setSyncLoading(true);
    try {
      applyConfig();
      await syncDatabase();
      showToast('Cloud data downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Sync failed', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleUploadCloud = async () => {
    if (!window.confirm('Upload local device records to GitHub cloud?')) {
      return;
    }
    setSyncLoading(true);
    try {
      applyConfig();
      await syncPush();
      showToast('Device records uploaded to GitHub', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleBackupAndWipe = async () => {
    if (!window.confirm('Backup to GitHub cloud and WIPE local records on this device?')) {
      return;
    }
    setSyncLoading(true);
    try {
      applyConfig();
      await syncPush();
      await db.transactions.clear();
      showToast('Backup successful. Device wiped.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Backup failed. Wipe aborted.', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  // --- IMPORT STATE ---
  const [importText, setImportText] = useState('');
  const [importStep, setImportStep] = useState<'input' | 'preview'>('input');
  const [previewTransactions, setPreviewTransactions] = useState<Transaction[]>([]);
  const [failedLines, setFailedLines] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  const handleParse = async () => {
    if (!importText.trim()) return;
    setImportLoading(true);
    try {
      const result = await parseTextToPreview(importText);
      setPreviewTransactions(result.transactions);
      setFailedLines(result.failedLines);
      setImportStep('preview');
    } catch {
      showToast('Failed to parse text', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (previewTransactions.length === 0) return;
    setImportLoading(true);
    try {
      await db.transactions.bulkAdd(previewTransactions);
      showToast(`${previewTransactions.length} transactions imported`, 'success');
      setImportText('');
      setImportStep('input');
      setPreviewTransactions([]);
      setFailedLines([]);
      onFinishImport?.();
    } catch {
      showToast('Failed to commit import', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  // --- EXPORT STATE ---
  const [copied, setCopied] = useState(false);
  const exportedText = useMemo(() => {
    return exportTransactionsToText(transactions);
  }, [transactions]);

  const handleCopyExport = async () => {
    if (!exportedText) return;
    try {
      await navigator.clipboard.writeText(exportedText);
      setCopied(true);
      showToast('Copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const handleDownloadFile = () => {
    if (!exportedText) return;
    const blob = new Blob([exportedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance_tracker_export_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Download started', 'info');
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Section Selector */}
      <SegmentedControl<ToolSection>
        options={[
          { id: 'sync', label: 'Cloud Sync', icon: <Cloud size={13} /> },
          { id: 'import', label: 'Bulk Import', icon: <FileText size={13} /> },
          { id: 'export', label: 'Export', icon: <FileDown size={13} /> }
        ]}
        value={section}
        onChange={setSection}
      />

      {/* --- CLOUD SYNC VIEW --- */}
      {section === 'sync' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 rounded-2xl bg-[#101014] border border-white/5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">GitHub Settings</h3>
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Personal Vault</span>
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Access Token</label>
                <input
                  type="password"
                  value={ghConfig.token}
                  onChange={(e) => setGhConfig({ ...ghConfig, token: e.target.value })}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Owner</label>
                  <input
                    type="text"
                    value={ghConfig.owner}
                    onChange={(e) => setGhConfig({ ...ghConfig, owner: e.target.value })}
                    placeholder="username"
                    className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Repo</label>
                  <input
                    type="text"
                    value={ghConfig.repo}
                    onChange={(e) => setGhConfig({ ...ghConfig, repo: e.target.value })}
                    placeholder="repository"
                    className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">File Path</label>
                <input
                  type="text"
                  value={ghConfig.path}
                  onChange={(e) => setGhConfig({ ...ghConfig, path: e.target.value })}
                  placeholder="data.json"
                  className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 px-1 pt-1">
                <input
                  type="checkbox"
                  id="rememberConfig"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded bg-black/50 border-white/10 text-primary accent-primary"
                />
                <label htmlFor="rememberConfig" className="text-xs text-zinc-400 font-bold select-none cursor-pointer">
                  Remember credentials on this device
                </label>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={<Save size={13} />}
                onClick={handleSaveConfig}
                className="w-full mt-1"
              >
                Save Settings
              </Button>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="space-y-2">
            <Button
              variant="primary"
              size="md"
              loading={syncLoading}
              icon={<Cloud size={15} />}
              onClick={handleUploadCloud}
              className="w-full"
            >
              Upload Device Data to Cloud
            </Button>

            <Button
              variant="secondary"
              size="md"
              loading={syncLoading}
              icon={<RefreshCw size={14} />}
              onClick={handleDownloadCloud}
              className="w-full text-amber-400 hover:text-amber-300"
            >
              Download Cloud Data
            </Button>

            <Button
              variant="danger"
              size="sm"
              loading={syncLoading}
              icon={<Trash2 size={13} />}
              onClick={handleBackupAndWipe}
              className="w-full mt-2"
            >
              Backup & Wipe Device
            </Button>
          </div>
        </div>
      )}

      {/* --- BULK IMPORTER VIEW --- */}
      {section === 'import' && (
        <div className="space-y-4 animate-fade-in">
          {importStep === 'input' ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#101014] border border-white/5 space-y-2">
                <div className="text-xs font-black text-white uppercase tracking-wider">Paste Notepad Text</div>
                <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                  Supports month headers e.g. <code className="text-primary">January 2025 (80k+10k)</code> and lines like <code className="text-zinc-300">5k Rent</code>, <code className="text-zinc-300">1200 Groceries</code>, <code className="text-zinc-300">• 400 Coffee</code>.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="January 2025 (80k+10k)&#10;5k Rent&#10;1200 Groceries&#10;• 400 Coffee"
                  className="w-full h-44 bg-[#16161c] border border-white/10 rounded-xl p-3 text-xs font-mono text-zinc-200 outline-none resize-none leading-relaxed"
                />
              </div>

              <Button
                variant="primary"
                size="md"
                disabled={!importText.trim()}
                loading={importLoading}
                icon={<ArrowRight size={14} />}
                onClick={handleParse}
                className="w-full"
              >
                Parse Preview
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setImportStep('input')}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Valid Records ({previewTransactions.length})
                </span>
              </div>

              {/* Preview Table */}
              <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-white/5 bg-[#101014]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#16161c] text-zinc-400 text-[9px] uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5 text-right">Amount</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {previewTransactions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-2.5">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                              t.type === 'INCOME'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {t.type === 'INCOME' ? 'INC' : 'EXP'}
                          </span>
                        </td>
                        <td
                          className={`p-2.5 text-right font-black tabular-nums ${
                            t.type === 'INCOME' ? 'text-emerald-400' : 'text-zinc-200'
                          }`}
                        >
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="p-2.5 text-zinc-400 text-[11px] truncate max-w-[120px]">
                          {t.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Unparsed Lines Diagnostic Box */}
              {failedLines.length > 0 && (
                <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/15 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-400 text-[10px] font-bold uppercase">
                    <AlertCircle size={12} /> Ignored Lines ({failedLines.length})
                  </div>
                  <div className="max-h-20 overflow-y-auto custom-scrollbar font-mono text-[9px] text-rose-400/70 space-y-0.5">
                    {failedLines.map((line, i) => (
                      <div key={i} className="truncate">{line}</div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                size="md"
                loading={importLoading}
                disabled={previewTransactions.length === 0}
                icon={<CheckCircle2 size={14} />}
                onClick={handleCommitImport}
                className="w-full"
              >
                Commit {previewTransactions.length} Transactions
              </Button>
            </div>
          )}
        </div>
      )}

      {/* --- EXPORT VIEW --- */}
      {section === 'export' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-3.5 rounded-2xl bg-[#101014] border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Notepad Export Preview</h3>
              <span className="text-[10px] text-zinc-500 font-bold">{transactions.length} entries</span>
            </div>
            <textarea
              readOnly
              value={exportedText || 'No transactions to export.'}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className="w-full h-44 bg-[#16161c] border border-white/10 rounded-xl p-3 text-xs font-mono text-zinc-300 outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              size="md"
              icon={copied ? <Check size={14} className="text-emerald-400" /> : <Clipboard size={14} />}
              onClick={handleCopyExport}
              disabled={!exportedText}
              className="flex-1"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<FileDown size={14} />}
              onClick={handleDownloadFile}
              disabled={!exportedText}
              className="flex-1"
            >
              Download .txt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
