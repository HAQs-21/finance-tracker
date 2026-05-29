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
  type?: 'income' | 'expense' | 'neutral';
  icon?: React.ReactNode;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, type = 'neutral', icon }) => {
  const valueColor = {
    income: 'text-emerald-400',
    expense: 'text-rose-400',
    neutral: 'text-white'
  }[type];

  return (
    <div className="bg-[#1E1E1E] p-4 rounded-xl border border-white/10 flex flex-col gap-1 active:bg-[#2A2A2A] transition-colors">
      <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
        {title}
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <div className={cn("text-2xl font-bold tracking-tight", valueColor)}>
        {formatCurrency(value)}
      </div>
    </div>
  );
};
