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
  FileText, 
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
      <div className="bg-[#1E1E1E] rounded-xl p-5 border border-white/10 space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-2 rounded-lg text-primary">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Bulk Importer</h2>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">Unstructured Text</p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="January (80k+10k)&#10;5k Rent&#10;1200 Groceries"
          className="w-full h-48 bg-[#121212] border border-white/10 rounded-lg p-4 text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-primary transition-colors font-mono text-xs resize-none"
          disabled={loading}
        />

        <button
          onClick={handleParse}
          disabled={loading || !text.trim()}
          className="w-full bg-primary text-[#121212] font-bold py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <>Parse Preview <ArrowRight size={14} /></>}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#1E1E1E] rounded-xl p-5 border border-white/10 space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
        <button onClick={() => setStep('input')} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-zinc-400" />
        </button>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Review Parsing</h2>
        <div className="w-8" />
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-bold text-zinc-500 uppercase px-1">
          Valid Transactions ({previewData.length})
        </div>
        
        <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 no-scrollbar bg-[#121212]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#2A2A2A] text-zinc-400 text-[9px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Desc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {previewData.map((t, i) => (
                <tr key={i} className="text-zinc-300">
                  <td className="px-3 py-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {t.type.substring(0,3)}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-white'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[100px] opacity-80">{t.description}</td>
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
            <span className="text-[9px] font-bold uppercase tracking-wider">Skipped ({failedLines.length})</span>
          </div>
          <div className="p-3 bg-rose-500/5 rounded-lg border border-rose-500/10 max-h-24 overflow-y-auto no-scrollbar font-mono text-[10px] text-rose-400/60 leading-relaxed">
            {failedLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={reset}
          className="flex-1 border border-white/10 text-zinc-400 font-bold py-3 rounded-lg hover:bg-white/5 transition-colors text-xs"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || previewData.length === 0}
          className="flex-[2] bg-primary text-[#121212] font-bold py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <>Commit <CheckCircle2 size={14} /></>}
        </button>
      </div>
    </div>
  );
};
