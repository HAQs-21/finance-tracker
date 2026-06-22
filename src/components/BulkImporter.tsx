import React, { useState } from 'react';
import { db } from '../db/db';
import { parseTextToPreview } from '../db/bulkImport';
import type { Transaction } from '../types';
import { formatCurrency } from '../db/financeUtils';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  ChevronLeft 
} from 'lucide-react';

interface BulkImporterProps {
  onComplete: () => void;
}

type Step = 'input' | 'preview';

export const BulkImporter: React.FC<BulkImporterProps> = ({ onComplete }) => {
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Transaction[]>([]);
  const [failedLines, setFailedLines] = useState<string[]>([]);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await parseTextToPreview(text);
      setPreviewData(result.transactions);
      setFailedLines(result.failedLines);
      setStep('preview');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (previewData.length > 0) {
        await db.transactions.bulkAdd(previewData);
      }
      onComplete();
      reset();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setText('');
    setStep('input');
    setPreviewData([]);
    setFailedLines([]);
  };

  if (step === 'input') {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="January (80k+10k)&#10;5k Rent&#10;1200 Groceries"
          className="w-full h-44 premium-input font-mono text-xs resize-none placeholder:text-zinc-600 leading-relaxed"
          disabled={loading}
        />

        <button
          onClick={handleParse}
          disabled={loading || !text.trim()}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-violet-600/10 flex items-center justify-center gap-2 text-xs cursor-pointer btn-pop disabled:shadow-none"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <>Parse Preview <ArrowRight size={14} /></>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between pb-1">
        <button 
          onClick={reset} 
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          Valid Transactions ({previewData.length})
        </span>
      </div>

      <div className="space-y-3">
        <div className="max-h-56 overflow-y-auto rounded-xl border border-white/5 bg-black/25 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-950/80 backdrop-blur-sm text-zinc-400 text-[9px] uppercase tracking-widest font-semibold border-b border-white/5">
              <tr>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {previewData.map((t, i) => (
                <tr key={i} className="text-zinc-300 hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${t.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'}`}>
                      {t.type === 'INCOME' ? 'INC' : 'EXP'}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-black ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-zinc-100'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="px-4 py-2.5 truncate max-w-[120px] text-zinc-400 text-[11px] font-medium">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {failedLines.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-rose-400 px-1">
            <AlertCircle size={12} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Unparsed Lines ({failedLines.length})</span>
          </div>
          <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 max-h-24 overflow-y-auto custom-scrollbar font-mono text-[10px] text-rose-400/60 leading-relaxed">
            {failedLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={reset}
          className="flex-1 bg-white/[0.03] border border-white/10 text-zinc-300 font-bold py-3.5 rounded-xl hover:bg-white/[0.06] hover:text-white text-xs cursor-pointer btn-pop"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || previewData.length === 0}
          className="flex-[2] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-violet-600/10 flex items-center justify-center gap-2 text-xs cursor-pointer shadow-md btn-pop"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <>Commit <CheckCircle2 size={14} /></>}
        </button>
      </div>
    </div>
  );
};
