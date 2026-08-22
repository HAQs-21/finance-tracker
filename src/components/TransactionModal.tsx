import React, { useState, useMemo, useEffect } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';
import { PREDEFINED_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { formatCurrency } from '../db/financeUtils';
import { useToast } from '../context/ToastContext';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar, 
  Clock, 
  Activity, 
  BarChart3, 
  Edit3, 
  Trash2, 
  Check 
} from 'lucide-react';
import type { Transaction, TransactionType } from '../types';

interface TransactionModalProps {
  transaction: Transaction | null;
  allTransactions: Transaction[];
  onClose: () => void;
  onUpdate: (id: number, data: Partial<Transaction>) => Promise<any>;
  onDelete: (id: number) => Promise<any>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  transaction,
  allTransactions,
  onClose,
  onUpdate,
  onDelete
}) => {
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setType(transaction.type);
      setCategory(transaction.category);
      setDescription(transaction.description || '');
      setDate(transaction.date);
      setIsEditing(false);
    }
  }, [transaction]);

  // Insights analytics computation
  const insights = useMemo(() => {
    if (!transaction || allTransactions.length === 0) return null;

    const queryKey = (transaction.description || transaction.category).trim().toLowerCase();
    if (!queryKey) return null;

    const matches = allTransactions.filter(
      (t) =>
        t.type === transaction.type &&
        (t.description || t.category).trim().toLowerCase() === queryKey
    );

    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7);
    const currentYearStr = now.toISOString().slice(0, 4);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    let thisWeek = 0;
    let thisMonth = 0;
    let thisYear = 0;
    let total = 0;

    matches.forEach((t) => {
      total += t.amount;
      if (t.date >= sevenDaysAgoStr) thisWeek += t.amount;
      if (t.date.startsWith(currentMonthStr)) thisMonth += t.amount;
      if (t.date.startsWith(currentYearStr)) thisYear += t.amount;
    });

    return {
      count: matches.length,
      total,
      thisWeek,
      thisMonth,
      thisYear
    };
  }, [transaction, allTransactions]);

  if (!transaction) return null;

  const Icon = getCategoryIcon(transaction.category);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction.id) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }
    if (!date) {
      showToast('Date is required', 'error');
      return;
    }

    setLoading(true);
    try {
      await onUpdate(transaction.id, {
        amount: Math.abs(numAmount),
        type,
        category: type === 'INCOME' ? 'Income' : (category.trim() || 'General'),
        description: description.trim(),
        date
      });
      showToast('Transaction updated', 'success');
      setIsEditing(false);
      onClose();
    } catch {
      showToast('Failed to update transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction.id) return;
    if (window.confirm('Delete this transaction?')) {
      try {
        await onDelete(transaction.id);
        showToast('Transaction deleted', 'success');
        onClose();
      } catch {
        showToast('Failed to delete', 'error');
      }
    }
  };

  return (
    <BottomSheet
      isOpen={!!transaction}
      onClose={onClose}
      title={isEditing ? 'Edit Record' : undefined}
    >
      {!isEditing ? (
        <div className="space-y-5 pb-2">
          {/* Main Transaction Header Card */}
          <div className="p-4 rounded-2xl bg-[#16161c] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  transaction.type === 'INCOME'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                <Icon size={18} />
              </div>
              <div className="truncate">
                <div className="text-base font-black text-white truncate">
                  {transaction.description || transaction.category}
                </div>
                <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-bold mt-0.5">
                  <span>{transaction.category}</span>
                  <span>•</span>
                  <span>{transaction.date}</span>
                </div>
              </div>
            </div>

            <div
              className={`text-lg sm:text-xl font-black tabular-nums shrink-0 ml-3 ${
                transaction.type === 'INCOME' ? 'text-emerald-400' : 'text-zinc-100'
              }`}
            >
              {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
            </div>
          </div>

          {/* 4-Window Analytics Insights */}
          {insights && insights.count > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 px-1 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <BarChart3 size={13} className="text-primary" />
                <span>Insights & Spending History</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#16161c]/70 rounded-xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[9px] font-bold uppercase">
                    <Activity size={12} /> Times Logged
                  </div>
                  <div className="text-sm font-black text-white">{insights.count} times</div>
                </div>

                <div className="p-3 bg-[#16161c]/70 rounded-xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[9px] font-bold uppercase">
                    <Clock size={12} /> Past 7 Days
                  </div>
                  <div className="text-sm font-black text-white">{formatCurrency(insights.thisWeek)}</div>
                </div>

                <div className="p-3 bg-[#16161c]/70 rounded-xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[9px] font-bold uppercase">
                    <Calendar size={12} /> This Month
                  </div>
                  <div className="text-sm font-black text-white">{formatCurrency(insights.thisMonth)}</div>
                </div>

                <div className="p-3 bg-[#16161c]/70 rounded-xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[9px] font-bold uppercase">
                    <BarChart3 size={12} /> This Year
                  </div>
                  <div className="text-sm font-black text-white">{formatCurrency(insights.thisYear)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="md"
              icon={<Edit3 size={14} />}
              onClick={() => setIsEditing(true)}
              className="flex-1"
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="md"
              icon={<Trash2 size={14} />}
              onClick={handleDelete}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveEdit} className="space-y-4 pb-2">
          <SegmentedControl<TransactionType>
            options={[
              {
                id: 'EXPENSE',
                label: 'Spending',
                icon: <ArrowDownLeft size={14} />,
                activeColor: 'bg-rose-500 text-white'
              },
              {
                id: 'INCOME',
                label: 'Income',
                icon: <ArrowUpRight size={14} />,
                activeColor: 'bg-emerald-500 text-white'
              }
            ]}
            value={type}
            onChange={setType}
          />

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Amount</label>
            <div className="relative flex items-center bg-[#16161c] rounded-2xl border border-white/10 p-3">
              <span className="text-sm font-bold text-zinc-500 mr-2">PKR</span>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className="w-full bg-transparent text-xl font-black text-white tabular-nums outline-none"
              />
            </div>
          </div>

          {type === 'EXPENSE' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Category</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-[#16161c]/60 rounded-2xl border border-white/5 max-h-24 overflow-y-auto no-scrollbar">
                {PREDEFINED_CATEGORIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      category.toLowerCase() === c.name.toLowerCase()
                        ? 'bg-primary text-white scale-[1.02]'
                        : 'bg-[#101014] text-zinc-400 border border-white/5'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Custom category..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Note</label>
              <input
                type="text"
                placeholder="Note..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsEditing(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              icon={<Check size={14} />}
              className="flex-[2]"
            >
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
};
