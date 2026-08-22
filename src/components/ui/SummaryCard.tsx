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
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  type = 'neutral',
  icon,
  subtitle,
  className,
  onClick
}) => {
  const styles = {
    income: {
      text: 'text-emerald-400',
      border: 'border-emerald-500/20 hover:border-emerald-500/30',
      bg: 'bg-emerald-950/[0.08]',
      iconBg: 'bg-emerald-500/10 text-emerald-400'
    },
    expense: {
      text: 'text-rose-400',
      border: 'border-rose-500/20 hover:border-rose-500/30',
      bg: 'bg-rose-950/[0.08]',
      iconBg: 'bg-rose-500/10 text-rose-400'
    },
    savings: {
      text: 'text-violet-400',
      border: 'border-violet-500/25 hover:border-violet-500/40',
      bg: 'bg-violet-950/[0.12]',
      iconBg: 'bg-violet-500/15 text-violet-300'
    },
    neutral: {
      text: 'text-white',
      border: 'border-white/10 hover:border-white/15',
      bg: 'bg-[#1E1E1E]',
      iconBg: 'bg-white/5 text-zinc-400'
    }
  }[type];

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden",
        styles.bg,
        styles.border,
        onClick && "cursor-pointer active:scale-[0.98]",
        className
      )}
    >
      <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1.5">
        <span className="truncate">{title}</span>
        {icon && (
          <div className={cn("p-1.5 rounded-lg shrink-0 ml-1.5", styles.iconBg)}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className={cn("text-xl sm:text-2xl font-black tracking-tight truncate", styles.text)}>
          {formatCurrency(value)}
        </div>
        {subtitle && (
          <p className="text-[10px] text-zinc-500 font-medium tracking-wide mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
