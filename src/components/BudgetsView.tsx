import React, { useState, useMemo } from 'react';
import { Plus, X, Edit2, Trash2, Check, AlertTriangle, Target, ChevronDown, CheckCircle2, PieChart, Landmark } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { PREDEFINED_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { formatCurrency } from '../db/financeUtils';
import { useToast } from '../context/ToastContext';
import type { CategoryStat, Budget } from '../types';

interface BudgetsViewProps {
  stats: CategoryStat[];
  budgets: Budget[];
  currentMonth: string;
  onSetBudget: (data: Budget) => Promise<any>;
  onDeleteBudget: (category: string, month?: string) => Promise<any>;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  stats,
  budgets,
  currentMonth,
  onSetBudget,
  onDeleteBudget
}) => {
  const { showToast } = useToast();
  const isAllTime = currentMonth === 'ALL';

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [targetMonth, setTargetMonth] = useState(isAllTime ? new Date().toISOString().slice(0, 7) : currentMonth);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [showUnbudgeted, setShowUnbudgeted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter budgets relevant to the current month or default
  const activeMonthBudgets = useMemo(() => {
    if (isAllTime) {
      const map = new Map<string, Budget>();
      budgets.forEach((b) => {
        const baseName = b.category.split('@')[0].trim();
        map.set(baseName.toLowerCase(), {
          category: baseName,
          amount: b.amount,
          month: b.month
        });
      });
      return Array.from(map.values());
    }

    // First collect default budgets, then override with month-specific ones
    const budgetMap = new Map<string, Budget>();
    
    budgets.forEach((b) => {
      const parts = b.category.split('@');
      const baseName = parts[0].trim();
      const monthPart = parts[1] || b.month || 'DEFAULT';

      if (monthPart === 'DEFAULT') {
        if (!budgetMap.has(baseName.toLowerCase())) {
          budgetMap.set(baseName.toLowerCase(), { category: baseName, amount: b.amount, month: 'DEFAULT' });
        }
      } else if (monthPart === currentMonth) {
        budgetMap.set(baseName.toLowerCase(), { category: baseName, amount: b.amount, month: currentMonth });
      }
    });

    return Array.from(budgetMap.values());
  }, [budgets, currentMonth, isAllTime]);

  // Map spending by normalized category name
  const spendMap = useMemo(() => {
    const map = new Map<string, number>();
    stats.forEach((s) => {
      map.set(s.category.trim().toLowerCase(), s.amount);
    });
    return map;
  }, [stats]);

  // Budget calculations for specific month
  const budgetCalculations = useMemo(() => {
    let totalBudget = 0;
    let totalSpentInBudgeted = 0;

    const budgetedCategories = activeMonthBudgets.map((b) => {
      const spent = spendMap.get(b.category.trim().toLowerCase()) || 0;
      totalBudget += b.amount;
      totalSpentInBudgeted += spent;

      const ratio = b.amount > 0 ? spent / b.amount : 0;
      const percentage = Math.min(ratio * 100, 100);
      const isOver = spent > b.amount;
      const remaining = b.amount - spent;

      return {
        category: b.category,
        budget: b.amount,
        spent,
        ratio,
        percentage,
        isOver,
        remaining,
        month: b.month
      };
    });

    // Unbudgeted spending categories
    const budgetedNames = new Set(activeMonthBudgets.map((b) => b.category.trim().toLowerCase()));
    const unbudgetedCategories = stats.filter(
      (s) => !budgetedNames.has(s.category.trim().toLowerCase())
    );
    const totalUnbudgetedSpent = unbudgetedCategories.reduce((sum, s) => sum + s.amount, 0);

    const overallRatio = totalBudget > 0 ? totalSpentInBudgeted / totalBudget : 0;
    const overallRemaining = totalBudget - totalSpentInBudgeted;

    return {
      budgetedCategories,
      unbudgetedCategories,
      totalBudget,
      totalSpentInBudgeted,
      totalUnbudgetedSpent,
      overallRatio,
      overallRemaining
    };
  }, [activeMonthBudgets, stats, spendMap]);

  // Quick categories that do not have a budget limit yet
  const availableQuickCategories = useMemo(() => {
    const budgetedNames = new Set(activeMonthBudgets.map((b) => b.category.trim().toLowerCase()));
    return PREDEFINED_CATEGORIES.filter((c) => !budgetedNames.has(c.name.toLowerCase()));
  }, [activeMonthBudgets]);

  const handleStartEdit = (category: string, currentBudget: number) => {
    setEditingCategory(category);
    setEditAmount(currentBudget.toString());
  };

  const handleSaveEdit = async (category: string) => {
    const amount = parseFloat(editAmount);
    try {
      if (isNaN(amount) || amount <= 0) {
        await onDeleteBudget(category, isAllTime ? undefined : currentMonth);
        showToast(`Limit removed for ${category}`, 'info');
      } else {
        await onSetBudget({ 
          category, 
          amount, 
          month: isAllTime ? 'DEFAULT' : currentMonth 
        });
        showToast(`Limit updated for ${category}`, 'success');
      }
    } catch {
      showToast('Failed to save budget', 'error');
    }
    setEditingCategory(null);
  };

  const handleDeleteBudget = async (category: string) => {
    if (window.confirm(`Remove budget limit for "${category}"?`)) {
      try {
        await onDeleteBudget(category, isAllTime ? undefined : currentMonth);
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
      showToast('Please select or enter a category name', 'error');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a limit greater than 0', 'error');
      return;
    }

    setLoading(true);
    try {
      await onSetBudget({ 
        category: trimmedCat, 
        amount, 
        month: targetMonth || (isAllTime ? 'DEFAULT' : currentMonth)
      });
      showToast(`Budget limit set for ${trimmedCat}`, 'success');
      setNewCategory('');
      setNewAmount('');
      setIsAddOpen(false);
    } catch {
      showToast('Failed to save budget', 'error');
    } finally {
      setLoading(false);
    }
  };

  const {
    budgetedCategories,
    unbudgetedCategories,
    totalBudget,
    totalSpentInBudgeted,
    totalUnbudgetedSpent,
    overallRatio,
    overallRemaining
  } = budgetCalculations;

  // --- ALL-TIME EXPENSES VIEW ---
  if (isAllTime) {
    const totalLifetimeSpend = stats.reduce((sum, s) => sum + s.amount, 0);
    const taxStat = stats.find((s) => s.category.trim().toLowerCase() === 'tax');
    const totalTaxPaid = taxStat ? taxStat.amount : 0;

    return (
      <div className="space-y-4 animate-fade-in pb-4">
        {/* Header */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#181226] to-[#0e0c14] border border-violet-500/20 shadow-xl shadow-black/40 space-y-2">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Lifetime Spending
          </div>
          <div className="text-3xl font-black text-white tabular-nums">
            {formatCurrency(totalLifetimeSpend)}
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">
            Showing all categories and spending across all time. Select a specific month in header to set and track monthly budget limits.
          </p>
        </div>

        {/* Dedicated Tax Section Card */}
        <div className="p-4 rounded-3xl bg-[#14121a] border border-amber-500/25 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Landmark size={16} />
              </div>
              <div>
                <div className="text-xs font-black text-white uppercase tracking-wider">Tax</div>
                <div className="text-[10px] text-zinc-400 font-medium">Total recorded tax payments</div>
              </div>
            </div>
            <div className="text-lg font-black text-amber-300 tabular-nums">
              {formatCurrency(totalTaxPaid)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 pt-1">
          <h2 className="text-xs font-black text-white uppercase tracking-wider">All Categories</h2>
          <span className="text-[10px] font-bold text-zinc-500">{stats.length} categories</span>
        </div>

        {/* Bold Category Expenses List */}
        <div className="space-y-2.5">
          {stats.length === 0 ? (
            <div className="p-8 text-center bg-[#101014] rounded-2xl border border-white/5 space-y-2">
              <div className="w-10 h-10 rounded-full bg-white/5 text-zinc-500 flex items-center justify-center mx-auto">
                <PieChart size={18} />
              </div>
              <div className="text-xs font-bold text-zinc-300">No expenses recorded</div>
            </div>
          ) : (
            stats.map((item) => {
              const Icon = getCategoryIcon(item.category);
              return (
                <div
                  key={item.category}
                  className="p-4 rounded-2xl bg-[#101014] border border-white/5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-white/5 text-zinc-300 flex items-center justify-center shrink-0">
                        <Icon size={16} />
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-black text-white truncate">{item.category}</div>
                        <div className="text-[10px] font-bold text-zinc-500 mt-0.5">
                          {item.percentage.toFixed(1)}% of total expenses
                        </div>
                      </div>
                    </div>

                    <div className="text-base font-black text-zinc-100 tabular-nums shrink-0 ml-3">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>

                  {/* Share Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#16161c] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // --- MONTHLY BUDGETS VIEW ---
  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Overall Monthly Budget Hero Card */}
      {totalBudget > 0 && (
        <section className="p-5 rounded-3xl bg-gradient-to-b from-[#181226] to-[#0e0c14] border border-violet-500/20 shadow-xl shadow-black/40 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Monthly Budget
              </div>
              <div className="text-2xl font-black text-white mt-0.5 tabular-nums">
                {formatCurrency(totalBudget)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {overallRemaining >= 0 ? 'Remaining' : 'Over Budget'}
              </div>
              <div
                className={`text-xl font-black mt-0.5 tabular-nums ${
                  overallRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(Math.abs(overallRemaining))}
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  overallRatio > 1
                    ? 'bg-rose-500'
                    : overallRatio > 0.85
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(overallRatio * 100, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
              <span>{formatCurrency(totalSpentInBudgeted)} spent</span>
              <span>{Math.round(overallRatio * 100)}% of total budget</span>
            </div>
          </div>
        </section>
      )}

      {/* Header & Add Button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xs font-black text-white uppercase tracking-wider">Category Limits</h2>
          <p className="text-[10px] font-bold text-zinc-500 mt-0.5">
            {budgetedCategories.length} {budgetedCategories.length === 1 ? 'limit active' : 'limits active'}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={13} />}
          onClick={() => {
            setTargetMonth(currentMonth);
            setIsAddOpen(true);
          }}
        >
          Add Limit
        </Button>
      </div>

      {/* --- ACTIVE BUDGETED CATEGORIES --- */}
      <div className="space-y-2.5">
        {budgetedCategories.length === 0 ? (
          <div className="p-8 text-center bg-[#101014] rounded-2xl border border-white/5 space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/5 text-zinc-500 flex items-center justify-center mx-auto">
              <Target size={18} />
            </div>
            <div className="text-xs font-bold text-zinc-300">No category limits set for this month</div>
            <p className="text-[10px] text-zinc-500">
              Tap "Add Limit" to set spending targets for Food, Rent, Shopping, etc.
            </p>
          </div>
        ) : (
          budgetedCategories.map((item) => {
            const Icon = getCategoryIcon(item.category);
            const isEditing = editingCategory === item.category;

            let barColor = 'bg-emerald-400';
            let statusTextColor = 'text-emerald-400';
            if (item.ratio > 1) {
              barColor = 'bg-rose-500';
              statusTextColor = 'text-rose-400';
            } else if (item.ratio > 0.85) {
              barColor = 'bg-amber-400';
              statusTextColor = 'text-amber-400';
            }

            return (
              <div
                key={item.category}
                className="p-4 rounded-2xl bg-[#101014] border border-white/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-white/5 text-zinc-300 flex items-center justify-center shrink-0">
                      <Icon size={15} />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-black text-white truncate">{item.category}</div>
                      <div className="text-[10px] font-bold text-zinc-400 mt-0.5">
                        {formatCurrency(item.spent)} of {formatCurrency(item.budget)}
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
                          className="w-16 bg-transparent text-xs font-bold text-white outline-none tabular-nums"
                        />
                        <button
                          onClick={() => handleSaveEdit(item.category)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(item.category, item.budget)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 cursor-pointer pressable"
                          title="Edit Limit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteBudget(item.category)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer pressable"
                          title="Delete Limit"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Status Text */}
                <div className="space-y-1.5">
                  <div className="w-full h-1.5 rounded-full bg-[#16161c] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-bold">
                    <span className={statusTextColor}>
                      {item.isOver ? (
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={10} /> Over by {formatCurrency(Math.abs(item.remaining))}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={10} /> {formatCurrency(item.remaining)} left
                        </span>
                      )}
                    </span>
                    <span className="text-zinc-500">{Math.round(item.ratio * 100)}% used</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- UNBUDGETED SPENDING SECTION (Collapsible) --- */}
      {unbudgetedCategories.length > 0 && (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => setShowUnbudgeted(!showUnbudgeted)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#101014] border border-white/5 text-left cursor-pointer pressable"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400">Other Expenses</span>
              <span className="text-[9px] font-bold bg-white/5 text-zinc-500 px-2 py-0.5 rounded-md">
                {formatCurrency(totalUnbudgetedSpent)}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-zinc-500 transition-transform duration-200 ${
                showUnbudgeted ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showUnbudgeted && (
            <div className="space-y-1.5 pl-2">
              {unbudgetedCategories.map((s) => {
                const Icon = getCategoryIcon(s.category);
                return (
                  <div
                    key={s.category}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#121216] border border-white/5"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-6 h-6 rounded-lg bg-white/5 text-zinc-400 flex items-center justify-center shrink-0">
                        <Icon size={12} />
                      </div>
                      <span className="text-xs font-semibold text-zinc-300 truncate">
                        {s.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-zinc-200 tabular-nums">
                        {formatCurrency(s.amount)}
                      </span>
                      <button
                        onClick={() => {
                          setNewCategory(s.category);
                          setTargetMonth(currentMonth);
                          setIsAddOpen(true);
                        }}
                        className="text-[9px] font-bold text-primary hover:text-primary-hover px-2 py-1 rounded-lg bg-primary/10 cursor-pointer"
                      >
                        + Set Limit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- ADD BUDGET LIMIT BOTTOM SHEET --- */}
      <BottomSheet
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Category Limit"
        subtitle="Set a monthly spending threshold"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 pb-2">
          {availableQuickCategories.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">
                Quick Select
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar p-1 bg-[#141418] rounded-2xl border border-white/5">
                {availableQuickCategories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setNewCategory(c.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none pressable ${
                      newCategory.toLowerCase() === c.name.toLowerCase()
                        ? 'bg-primary text-white scale-[1.02]'
                        : 'bg-[#101014] text-zinc-400 border border-white/5 hover:text-zinc-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">
              Category Name
            </label>
            <input
              type="text"
              placeholder="e.g. Subscriptions, Food"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">
              Target Month
            </label>
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1">
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
            Save Limit
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
};
