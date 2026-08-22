import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatCurrency } from '../../db/financeUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SummaryCardProps {
  title: string;
  value: number;
  type?: 'income' | 'expense' | 'savings' | 'neutral';
  icon?: React.ReactNode;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, type = 'neutral', icon }) => {
  const valueColor = {
    income: 'text-emerald-400',
    expense: 'text-rose-400',
    savings: 'text-violet-400',
    neutral: 'text-white'
  }[type];

  return (
    <div className="bg-[#1E1E1E] p-3.5 sm:p-4 rounded-xl border border-white/10 flex flex-col gap-1 active:bg-[#2A2A2A] transition-colors overflow-hidden">
      <div className="flex items-center justify-between text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
        <span className="truncate">{title}</span>
        {icon && <span className="opacity-70 shrink-0 ml-1">{icon}</span>}
      </div>
      <div className={cn("text-base sm:text-xl font-black tracking-tight truncate", valueColor)}>
        {formatCurrency(value)}
      </div>
    </div>
  );
};
