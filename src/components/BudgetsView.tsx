import React, { useState, useMemo } from 'react';
import { Plus, X, Edit2, Trash2, Check, AlertTriangle, Target } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { PREDEFINED_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { formatCurrency } from '../db/financeUtils';
import { useToast } from '../context/ToastContext';
import type { CategoryStat, Budget } from '../types';

interface BudgetsViewProps {
  stats: CategoryStat[];
  budgets: Budget[];
  onSetBudget: (data: Budget) => Promise<any>;
  onDeleteBudget: (category: string) => Promise<any>;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  stats,
  budgets,
  onSetBudget,
  onDeleteBudget
}) => {
  const { showToast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Map budgets by category name
  const budgetMap = useMemo(() => {
    return new Map(budgets.map((b) => [b.category.toLowerCase(), b.amount]));
  }, [budgets]);

  // Combine categories with budget limit OR active spending
  const activeCategories = useMemo(() => {
    const names = new Set<string>();
    budgets.forEach((b) => names.add(b.category));
    stats.forEach((s) => names.add(s.category));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stats, budgets]);

  // Quick categories that do NOT have a budget limit yet
  const availableQuickCategories = useMemo(() => {
    return PREDEFINED_CATEGORIES.filter((c) => !budgetMap.has(c.name.toLowerCase()));
  }, [budgetMap]);

  const handleStartEdit = (category: string, currentBudget: number | undefined) => {
    setEditingCategory(category);
    setEditAmount(currentBudget ? currentBudget.toString() : '');
  };

  const handleSaveEdit = async (category: string) => {
    const amount = parseFloat(editAmount);
    try {
      if (isNaN(amount) || amount <= 0) {
        await onDeleteBudget(category);
        showToast(`Budget limit removed for ${category}`, 'info');
      } else {
        await onSetBudget({ category, amount });
        showToast(`Budget limit updated for ${category}`, 'success');
      }
    } catch {
      showToast('Failed to save budget', 'error');
    }
    setEditingCategory(null);
  };

  const handleDeleteBudget = async (category: string) => {
    if (window.confirm(`Remove budget limit for "${category}"?`)) {
      try {
        await onDeleteBudget(category);
        showToast(`Budget limit removed`, 'success');
      } catch {
        showToast('Failed to remove limit', 'error');
      }
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCat = newCategory.trim();
    const amount = parseFloat(newAmount);

    if (!trimmedCat) {
      showToast('Category name is required', 'error');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a limit greater than 0', 'error');
      return;
    }

    setLoading(true);
    try {
      await onSetBudget({ category: trimmedCat, amount });
      showToast(`Budget limit added for ${trimmedCat}`, 'success');
      setNewCategory('');
      setNewAmount('');
      setIsAddOpen(false);
    } catch {
      showToast('Failed to add budget limit', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-2">
      {/* Top Header Card */}
      <div className="p-4 rounded-2xl bg-[#101014] border border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Category Budgets</h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
            {budgets.length} {budgets.length === 1 ? 'Limit active' : 'Limits active'}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={13} />}
          onClick={() => setIsAddOpen(true)}
        >
          Add Limit
        </Button>
      </div>

      {/* Budgets List */}
      <div className="space-y-3">
        {activeCategories.length === 0 ? (
          <div className="p-8 text-center bg-[#101014] rounded-2xl border border-white/5 space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/5 text-zinc-500 flex items-center justify-center mx-auto">
              <Target size={18} />
            </div>
            <div className="text-xs font-bold text-zinc-400">No category limits set</div>
            <p className="text-[10px] text-zinc-600">
              Tap "Add Limit" above to set category spending targets
            </p>
          </div>
        ) : (
          activeCategories.map((category) => {
            const spendStat = stats.find(
              (s) => s.category.toLowerCase() === category.toLowerCase()
            );
            const spent = spendStat ? spendStat.amount : 0;
            const budget = budgetMap.get(category.toLowerCase());

            const Icon = getCategoryIcon(category);
            const hasBudget = budget !== undefined && budget > 0;
            const ratio = hasBudget ? spent / budget : 0;
            const percentage = Math.min(ratio * 100, 100);
            const isOver = hasBudget && spent > budget;
            const overAmount = isOver ? spent - budget : 0;

            // Bar Color
            let barColor = 'bg-primary';
            let textColor = 'text-zinc-300';
            if (hasBudget) {
              if (ratio > 1) {
                barColor = 'bg-rose-500';
                textColor = 'text-rose-400';
              } else if (ratio > 0.85) {
                barColor = 'bg-amber-400';
                textColor = 'text-amber-400';
              } else {
                barColor = 'bg-emerald-400';
                textColor = 'text-emerald-400';
              }
            }

            const isEditing = editingCategory === category;

            return (
              <div
                key={category}
                className="p-4 rounded-2xl bg-[#101014] border border-white/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-white/5 text-zinc-300 flex items-center justify-center shrink-0">
                      <Icon size={15} />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-black text-white truncate">{category}</div>
                      <div className="text-[10px] text-zinc-500 font-bold mt-0.5">
                        {hasBudget ? (
                          <span>
                            {formatCurrency(spent)} of {formatCurrency(budget)}
                          </span>
                        ) : (
                          <span>Spent: {formatCurrency(spent)} (No limit)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions / Inline Edit */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1 bg-[#16161c] px-2 py-1 rounded-xl border border-primary/40">
                        <input
                          type="number"
                          step="any"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          autoFocus
                          className="w-18 bg-transparent text-xs font-bold text-white outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(category)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(category, budget)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 cursor-pointer pressable"
                          title="Edit Limit"
                        >
                          <Edit2 size={13} />
                        </button>
                        {hasBudget && (
                          <button
                            onClick={() => handleDeleteBudget(category)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer pressable"
                            title="Delete Limit"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar (If has budget) */}
                {hasBudget && (
                  <div className="space-y-1.5">
                    <div className="w-full h-1.5 rounded-full bg-[#16161c] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-bold">
                      <span className={textColor}>{Math.round(ratio * 100)}% used</span>
                      {isOver && (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle size={10} /> Over by {formatCurrency(overAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Budget Limit Sheet */}
      <BottomSheet
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Budget Limit"
        subtitle="Set a monthly category spending threshold"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 pb-2">
          {availableQuickCategories.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">
                Quick Select
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar p-1">
                {availableQuickCategories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setNewCategory(c.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      newCategory === c.name
                        ? 'bg-primary text-white scale-[1.02]'
                        : 'bg-[#16161c] text-zinc-400 border border-white/5 hover:text-zinc-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">
              Category Name
            </label>
            <input
              type="text"
              placeholder="e.g. Subscriptions, Gaming"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">
              Monthly Limit (PKR)
            </label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none tabular-nums"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            className="w-full mt-2"
          >
            Create Budget Limit
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
};
