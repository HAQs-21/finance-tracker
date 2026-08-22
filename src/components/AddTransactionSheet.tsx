import React, { useState, useEffect } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { SegmentedControl } from './ui/SegmentedControl';
import { Button } from './ui/Button';
import { PREDEFINED_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { useToast } from '../context/ToastContext';
import { ArrowDownLeft, ArrowUpRight, Calendar, Tag } from 'lucide-react';
import type { TransactionType } from '../types';

interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    amount: number;
    type: TransactionType;
    category: string;
    description: string;
    date: string;
  }) => Promise<any>;
}

export const AddTransactionSheet: React.FC<AddTransactionSheetProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setCategory('');
      setDescription('');
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }
    if (!date) {
      showToast('Please select a date', 'error');
      return;
    }

    setLoading(true);
    try {
      const finalCategory = type === 'INCOME' ? 'Income' : (category.trim() || 'General');
      await onAdd({
        amount: Math.abs(numAmount),
        type,
        category: finalCategory,
        description: description.trim(),
        date
      });
      showToast(type === 'INCOME' ? 'Income logged' : 'Expense logged', 'success');
      onClose();
    } catch {
      showToast('Failed to save transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="New Transaction">
      <form onSubmit={handleSubmit} className="space-y-5 pb-2">
        {/* Type Toggle */}
        <SegmentedControl<TransactionType>
          options={[
            {
              id: 'EXPENSE',
              label: 'Spending',
              icon: <ArrowDownLeft size={14} />,
              activeColor: 'bg-rose-500 text-white shadow-rose-500/20'
            },
            {
              id: 'INCOME',
              label: 'Income',
              icon: <ArrowUpRight size={14} />,
              activeColor: 'bg-emerald-500 text-white shadow-emerald-500/20'
            }
          ]}
          value={type}
          onChange={setType}
        />

        {/* Large Focal Amount Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">
            Amount
          </label>
          <div className="relative flex items-center bg-[#16161c] rounded-2xl border border-white/10 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all p-3.5">
            <span className="text-base font-bold text-zinc-500 mr-2 select-none">PKR</span>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              className="w-full bg-transparent text-2xl font-black text-white tabular-nums outline-none placeholder:text-zinc-700"
            />
          </div>
        </div>

        {/* Category Selector (For Spending Only) */}
        {type === 'EXPENSE' && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Category
              </label>
              {category && (
                <button
                  type="button"
                  onClick={() => setCategory('')}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-[#16161c]/60 rounded-2xl border border-white/5 max-h-28 overflow-y-auto no-scrollbar">
              {PREDEFINED_CATEGORIES.map((c) => {
                const Icon = getCategoryIcon(c.name);
                const isSelected = category.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer pressable ${
                      isSelected
                        ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                        : 'bg-[#101014] text-zinc-400 border border-white/5 hover:text-zinc-200'
                    }`}
                  >
                    <Icon size={12} className={isSelected ? 'text-white' : 'text-zinc-500'} />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Category Input */}
            <input
              type="text"
              placeholder="Or enter custom category..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#16161c] border border-white/10 focus:border-primary/40 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-zinc-600 transition-colors"
            />
          </div>
        )}

        {/* Date & Note Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 flex items-center gap-1">
              <Calendar size={11} /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#16161c] border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2.5 text-xs text-zinc-200 outline-none transition-colors [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 flex items-center gap-1">
              <Tag size={11} /> Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Grocery, Lunch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#16161c] border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2.5 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Submit Action */}
        <Button
          type="submit"
          loading={loading}
          variant="primary"
          size="md"
          className="w-full mt-2"
        >
          Save Transaction
        </Button>
      </form>
    </BottomSheet>
  );
};
