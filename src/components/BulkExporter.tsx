import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { exportTransactionsToText } from '../utils/bulkExport';
import { FileDown, Clipboard, Check } from 'lucide-react';

export const BulkExporter: React.FC = () => {
  const [copied, setCopied] = useState(false);
  
  const transactions = useLiveQuery(
    () => db.transactions.toArray(),
    []
  ) ?? [];

  const textContent = useMemo(() => {
    return exportTransactionsToText(transactions);
  }, [transactions]);

  const handleCopy = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    if (!textContent) return;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance_tracker_export_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <textarea
        readOnly
        value={textContent || 'No transactions to export.'}
        className="w-full h-40 premium-input font-mono text-xs resize-none placeholder:text-zinc-650 leading-relaxed"
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
      />

      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          disabled={!textContent}
          className="flex-1 bg-white/[0.03] border border-white/10 text-zinc-300 hover:bg-white/[0.06] hover:text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer select-none btn-pop"
        >
          {copied ? <Check size={15} className="text-emerald-400" /> : <Clipboard size={15} />}
          <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
        </button>
        <button
          onClick={handleDownload}
          disabled={!textContent}
          className="flex-[2] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 select-none btn-pop"
        >
          <FileDown size={15} />
          <span>Download File</span>
        </button>
      </div>
    </div>
  );
};
