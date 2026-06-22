import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { CategoryStat } from '../types';
import { formatCurrency } from '../db/financeUtils';
import { PREDEFINED_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { Check, X, AlertCircle, Plus, Trash2, Edit2 } from 'lucide-react';

interface BudgetVarianceProps {
  stats: CategoryStat[];
}

export const BudgetVariance: React.FC<BudgetVarianceProps> = ({ stats }) => {
  const budgets = useLiveQuery(() => db.budgets.toArray()) ?? [];
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  
  // State for Add Budget form
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');

  // Map budgets by category name
  const budgetMap = React.useMemo(() => {
    return new Map(budgets.map((b) => [b.category, b.amount]));
  }, [budgets]);

  // Only display categories that:
  // 1. Have a budget set
  // 2. Or have active spending this month
  const activeCategories = React.useMemo(() => {
    const names = new Set<string>();
    
    // Add categories with active budgets
    budgets.forEach((b) => names.add(b.category));
    
    // Add categories with active spending
    stats.forEach((s) => names.add(s.category));
    
    return Array.from(names);
  }, [stats, budgets]);

  const handleStartEdit = (category: string, currentBudget: number | undefined) => {
    setEditingCategory(category);
    setEditAmount(currentBudget ? currentBudget.toString() : '');
  };

  const handleSaveEdit = async (category: string) => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      await db.budgets.delete(category);
    } else {
      await db.budgets.put({ category, amount });
    }
    setEditingCategory(null);
  };

  const handleDeleteBudget = async (category: string) => {
    if (window.confirm(`Are you sure you want to remove the budget limit for "${category}"?`)) {
      await db.budgets.delete(category);
    }
  };

  const handleAddBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory || !newAmount || isNaN(parseFloat(newAmount))) return;
    
    const amount = parseFloat(newAmount);
    if (amount > 0) {
      await db.budgets.put({ category: newCategory, amount });
    }
    
    setNewCategory('');
    setNewAmount('');
    setIsAdding(false);
  };

  // Quick categories that do NOT have a budget limit yet
  const availableQuickCategories = React.useMemo(() => {
    return PREDEFINED_CATEGORIES.filter(c => !budgetMap.has(c.name));
  }, [budgetMap]);

  return (
    <div className="bg-[#1E1E1E] p-5 rounded-2xl border border-white/10 space-y-5 animate-elegant-slide">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Category Budgets</h3>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-0.5">Track and set category limits</p>
        </div>
        
        {/* Toggle Add Budget Form */}
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 bg-primary text-[#121212] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer btn-pop shadow-sm shadow-primary/5"
        >
          {isAdding ? <X size={14} /> : <Plus size={14} />}
          <span>{isAdding ? 'Cancel' : 'Add Limit'}</span>
        </button>
      </div>

      {/* Add Budget Form (Animate slide down) */}
      {isAdding && (
        <form onSubmit={handleAddBudgetSubmit} className="bg-[#121212] p-4 rounded-xl border border-primary/20 space-y-3.5 animate-in slide-in-from-top-3 duration-200">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Select Predefined Category</label>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar p-1">
              {availableQuickCategories.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setNewCategory(c.name)}
                  className={`text-[9px] font-bold px-2 py-1 rounded border cursor-pointer btn-pop ${
                    newCategory === c.name 
                      ? 'bg-primary text-[#121212] border-primary shadow-sm shadow-primary/10' 
                      : 'bg-[#1E1E1E] text-zinc-400 border-white/5'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Or Custom Name</label>
              <input
                type="text"
                placeholder="e.g. Subscriptions"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full premium-input text-xs p-2.5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Limit (Rs.)</label>
              <input
                type="number"
                placeholder="0.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full premium-input text-xs font-mono p-2.5"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!newCategory || !newAmount}
            className="w-full bg-primary text-[#121212] font-bold py-2.5 rounded-lg text-xs hover:brightness-110 cursor-pointer btn-pop shadow-md shadow-primary/10"
          >
            Create Budget Limit
          </button>
        </form>
      )}

      {/* Budgets List */}
      <div className="space-y-4">
        {activeCategories.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-xs font-medium">
            No budgets defined. Click "Add Limit" to start tracking limits!
          </div>
        ) : (
          activeCategories.map((category) => {
            const spendStat = stats.find((s) => s.category.toLowerCase() === category.toLowerCase());
            const spent = spendStat ? spendStat.amount : 0;
            const budget = budgetMap.get(category);
            
            const Icon = getCategoryIcon(category);
            const hasBudget = budget !== undefined && budget > 0;
            const isOverBudget = hasBudget && spent > budget;
            const ratio = hasBudget ? (spent / budget) : 0;
            const percentage = Math.min(ratio * 100, 100);

            // Determine progress bar color
            let barColorClass = 'bg-primary';
            if (hasBudget) {
              if (ratio > 1) barColorClass = 'bg-rose-500';
              else if (ratio > 0.85) barColorClass = 'bg-amber-500';
              else barColorClass = 'bg-emerald-500';
            }

            const isEditing = editingCategory === category;

            return (
              <div key={category} className="space-y-2 pb-3 border-b border-white/5 last:border-0 last:pb-0 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  {/* Category Info */}
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="p-1.5 rounded-lg bg-white/5 text-zinc-400 shrink-0">
                      <Icon size={14} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-200 truncate">{category}</span>
                  </div>

                  {/* Budget Values / Form */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 bg-[#121212] px-2 py-1 rounded-lg border border-primary/40">
                        <span className="text-[10px] text-zinc-500 font-bold font-mono">Rs.</span>
                        <input
                          type="number"
                          placeholder="Limit"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-16 bg-transparent text-white font-bold text-xs focus:outline-none text-right font-mono"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleSaveEdit(category)}
                          className="text-emerald-400 hover:text-emerald-300 p-0.5 btn-pop"
                        >
                          <Check size={14} />
                        </button>
                        <button 
                          onClick={() => setEditingCategory(null)}
                          className="text-rose-400 hover:text-rose-300 p-0.5 btn-pop"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="text-right text-xs">
                          <span className="font-bold text-zinc-200 font-mono">
                            {formatCurrency(spent)}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-semibold font-mono">
                            / {hasBudget ? formatCurrency(budget!) : 'No limit'}
                          </span>
                        </div>
                        
                        {/* Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => handleStartEdit(category, budget)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-md cursor-pointer btn-pop"
                            title="Edit Limit"
                          >
                            <Edit2 size={11} />
                          </button>
                          {hasBudget && (
                            <button
                              onClick={() => handleDeleteBudget(category)}
                              className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/5 rounded-md cursor-pointer btn-pop"
                              title="Remove Limit"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Status messages */}
                <div className="space-y-1">
                  <div className="w-full bg-[#121212] rounded-full h-1.5 overflow-hidden border border-white/5">
                    <div
                      className={`${barColorClass} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${hasBudget ? percentage : (spent > 0 ? 100 : 0)}%` }}
                    />
                  </div>
                  
                  {isOverBudget && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-rose-400">
                      <AlertCircle size={10} />
                      <span>Over budget by {formatCurrency(spent - budget!)}!</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
