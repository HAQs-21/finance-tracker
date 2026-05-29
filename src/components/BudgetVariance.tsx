import React from 'react';
import type { CategoryStat } from '../types';
import { formatCurrency } from '../db/financeUtils';

interface BudgetVarianceProps {
  stats: CategoryStat[];
}

export const BudgetVariance: React.FC<BudgetVarianceProps> = ({ stats }) => {
  if (stats.length === 0) return null;

  return (
    <div className="bg-[#1E1E1E] p-5 rounded-xl border border-white/10 space-y-4">
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Variance</h3>
      <div className="space-y-3">
        {stats.map((stat) => (
          <div key={stat.category} className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-zinc-300 truncate max-w-[60%]">{stat.category}</span>
              <span className="font-mono text-zinc-500">
                {formatCurrency(stat.amount)} <span className="text-zinc-600">({Math.round(stat.percentage)}%)</span>
              </span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${stat.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
