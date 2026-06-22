import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Transaction, TransactionType } from '../types';
import { formatCurrency } from '../db/financeUtils';
import { X, Edit2, Trash2, Save, XCircle, BarChart3, Clock, Calendar, Activity } from 'lucide-react';
import { PREDEFINED_CATEGORIES } from '../utils/categories';


interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({ transaction, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setType(transaction.type);
      setCategory(transaction.category);
      setDescription(transaction.description);
      setDate(transaction.date);
      setIsEditing(false);
    }
  }, [transaction]);

  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const insights = useMemo(() => {
    if (!transaction || allTransactions.length === 0) return null;

    const queryDesc = (transaction.description || transaction.category).trim().toLowerCase();
    if (!queryDesc) return null;

    const matches = allTransactions.filter(t => 
      t.type === transaction.type && 
      (t.description || t.category).trim().toLowerCase() === queryDesc
    );

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentYear = now.toISOString().slice(0, 4);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    let thisWeek = 0;
    let thisMonth = 0;
    let thisYear = 0;
    let total = 0;

    matches.forEach(t => {
      total += t.amount;
      if (t.date >= sevenDaysAgoStr) thisWeek += t.amount;
      if (t.date.startsWith(currentMonth)) thisMonth += t.amount;
      if (t.date.startsWith(currentYear)) thisYear += t.amount;
    });

    return { count: matches.length, total, thisWeek, thisMonth, thisYear };
  }, [transaction, allTransactions]);

  if (!transaction) return null;

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      await db.transactions.delete(transaction.id!);
      onClose();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !date) return;

    await db.transactions.update(transaction.id!, {
      amount: Math.abs(Number(amount)),
      type,
      category: type === 'INCOME' ? 'Income' : (category.trim() || 'General'),
      description: description.trim(),
      date
    });
    
    setIsEditing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1E1E1E] rounded-t-3xl sm:rounded-2xl p-6 border border-white/10 animate-modal-reveal max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {isEditing ? 'Edit Record' : 'Details & Insights'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full cursor-pointer btn-pop">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {!isEditing ? (
          <div className="space-y-6 animate-in fade-in">
            {/* Header Info */}
            <div className="flex items-center gap-4 p-5 bg-[#121212] rounded-2xl border border-white/10">
              <div className="flex-1">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{transaction.category}</p>
                <h3 className="text-xl font-bold text-white leading-tight">{transaction.description || transaction.category}</h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">{transaction.date}</p>
              </div>
              <div className={`text-2xl font-bold tracking-tight ${transaction.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </div>
            </div>

            {/* Insights Engine */}
            {insights && insights.count > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <BarChart3 size={16} className="text-primary" />
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Item Analytics</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                      <Activity size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Total Times</span>
                    </div>
                    <div className="text-lg font-bold text-white">{insights.count} <span className="text-xs text-zinc-500 font-normal">records</span></div>
                  </div>
                  <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Past 7 Days</span>
                    </div>
                    <div className="text-lg font-bold text-white">{formatCurrency(insights.thisWeek)}</div>
                  </div>
                  <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                      <Calendar size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">This Month</span>
                    </div>
                    <div className="text-lg font-bold text-white">{formatCurrency(insights.thisMonth)}</div>
                  </div>
                  <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                      <BarChart3 size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">This Year</span>
                    </div>
                    <div className="text-lg font-bold text-white">{formatCurrency(insights.thisYear)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 flex items-center justify-center gap-2 text-sm cursor-pointer btn-pop"
              >
                <Edit2 size={16} /> Edit Record
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 bg-rose-500/10 text-rose-400 font-bold py-4 rounded-xl hover:bg-rose-500/20 flex items-center justify-center gap-2 text-sm border border-rose-500/10 cursor-pointer btn-pop"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 animate-in slide-in-from-right-4">
            <div className="flex bg-[#121212] p-1 rounded-xl border border-white/10">
              <button type="button" onClick={() => setType('EXPENSE')} className={`flex-1 py-2 rounded-lg font-bold text-xs cursor-pointer btn-pop ${type === 'EXPENSE' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>EXPENSE</button>
              <button type="button" onClick={() => setType('INCOME')} className={`flex-1 py-2 rounded-lg font-bold text-xs cursor-pointer btn-pop ${type === 'INCOME' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>INCOME</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Amount</label>
                <div className="relative">
                  {!amount && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500 pointer-events-none select-none">Rs.</span>
                  )}
                  <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className={`w-full premium-input pr-4 text-lg font-bold text-white font-mono transition-all ${!amount ? 'pl-12' : 'pl-4'}`} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full premium-input text-sm [color-scheme:dark]" />
              </div>
            </div>

            {type === 'EXPENSE' && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Category Quick Select</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar p-2 bg-[#121212] rounded-xl border border-white/10">
                  {PREDEFINED_CATEGORIES.map((c) => {
                    const isSelected = category.toLowerCase() === c.name.toLowerCase();
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setCategory(c.name)}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border cursor-pointer btn-pop ${
                          isSelected 
                            ? 'bg-primary text-[#121212] border-primary shadow-sm shadow-primary/10' 
                            : 'bg-[#1E1E1E] text-zinc-400 border-white/5 hover:text-zinc-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {type === 'EXPENSE' ? (
                <>
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Category (Custom)</label>
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full premium-input text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Description</label>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full premium-input text-sm" />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 col-span-2 animate-in fade-in duration-200">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full premium-input text-sm" />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-[#121212] text-zinc-400 font-bold py-4 rounded-xl hover:bg-zinc-850 flex items-center justify-center gap-2 text-sm border border-white/5 cursor-pointer btn-pop">
                <XCircle size={16} /> Cancel
              </button>
              <button type="submit" className="flex-[2] bg-primary text-[#121212] font-bold py-4 rounded-xl hover:brightness-110 flex items-center justify-center gap-2 text-sm cursor-pointer btn-pop shadow-lg shadow-primary/10">
                <Save size={16} /> Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
