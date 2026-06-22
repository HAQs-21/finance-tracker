import React, { useState } from 'react';
import { db } from '../db/db';
import type { TransactionType } from '../types';
import { X, Plus, Minus } from 'lucide-react';
import { PREDEFINED_CATEGORIES } from '../utils/categories';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !date) return;

    await db.transactions.add({
      amount: Math.abs(Number(amount)),
      type,
      category: type === 'INCOME' ? 'Income' : (category.trim() || 'General'),
      description: description.trim(),
      date
    });

    setAmount('');
    setDescription('');
    setCategory('');
    setDate(new Date().toISOString().slice(0, 10));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1E1E1E] rounded-t-3xl sm:rounded-2xl p-6 border-t border-x sm:border border-white/10 animate-modal-reveal">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Add Transaction</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full cursor-pointer btn-pop">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex bg-[#121212] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs cursor-pointer btn-pop ${
                type === 'EXPENSE' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/10' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Minus size={14} /> EXPENSE
            </button>
            <button
              type="button"
              onClick={() => setType('INCOME')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs cursor-pointer btn-pop ${
                type === 'INCOME' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Plus size={14} /> INCOME
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Amount</label>
              <div className="relative">
                {!amount && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500 pointer-events-none select-none">Rs.</span>
                )}
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  className={`w-full premium-input pr-4 text-lg font-bold text-white font-mono transition-all ${!amount ? 'pl-12' : 'pl-4'}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full premium-input text-sm [color-scheme:dark]"
              />
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
                  <input
                    type="text"
                    placeholder="Or type custom category..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full premium-input text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Description</label>
                  <input
                    type="text"
                    placeholder="Details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full premium-input text-sm"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5 col-span-2 animate-in fade-in duration-200">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Description</label>
                <input
                  type="text"
                  placeholder="Details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full premium-input text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-[#121212] font-bold py-4 rounded-xl hover:brightness-110 mt-4 cursor-pointer btn-pop shadow-lg shadow-primary/10"
          >
            Save Transaction
          </button>
        </form>
      </div>
    </div>
  );
};

