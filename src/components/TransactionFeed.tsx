import React, { useState, useMemo, useCallback, memo } from 'react';
import type { Transaction } from '../types';
import { Tag, ShoppingCart, Home, Car, Coffee, Briefcase, Zap, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../db/financeUtils';
import { Virtuoso } from 'react-virtuoso';

interface TransactionFeedProps {
  transactions: Transaction[];
  currentMonth: string;
  onSelect: (t: Transaction) => void;
}

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE';

const getCategoryIcon = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('food') || c.includes('coffee')) return <Coffee size={14} />;
  if (c.includes('shop') || c.includes('cloth')) return <ShoppingCart size={14} />;
  if (c.includes('rent') || c.includes('home')) return <Home size={14} />;
  if (c.includes('trans') || c.includes('car')) return <Car size={14} />;
  if (c.includes('work') || c.includes('salary')) return <Briefcase size={14} />;
  if (c.includes('util') || c.includes('elec')) return <Zap size={14} />;
  return <Tag size={14} />;
};

const TransactionRow = memo(({ t, onSelect }: { t: Transaction, onSelect: (t: Transaction) => void }) => {
  return (
    <button 
      onClick={() => onSelect(t)}
      className="w-full flex items-center justify-between p-3 bg-[#1E1E1E] border border-white/5 active:bg-[#2A2A2A] transition-colors text-left"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`p-2 rounded-lg shrink-0 ${t.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {getCategoryIcon(t.category)}
        </div>
        <div className="truncate">
          <div className="text-sm font-semibold text-zinc-200 truncate">{t.description || t.category}</div>
          <div className="text-[10px] font-medium text-zinc-500 truncate">{t.category}</div>
        </div>
      </div>
      <div className={`text-sm font-bold shrink-0 ml-4 ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-zinc-100'}`}>
        {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount)}
      </div>
    </button>
  );
});

const DateHeader = memo(({ date, isCollapsed, count, onToggle }: { date: string, isCollapsed: boolean, count: number, onToggle: (d: string) => void }) => {
  const dateObj = new Date(`${date}T00:00:00`);
  return (
    <button
      onClick={() => onToggle(date)}
      className="w-full flex items-center justify-between py-3 px-1 mt-4 bg-transparent outline-none"
    >
      <div className="flex items-center gap-2 text-zinc-400">
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div className="text-[10px] font-bold text-zinc-600">
        {count} records
      </div>
    </button>
  );
});

export const TransactionFeed: React.FC<TransactionFeedProps> = ({ transactions, currentMonth, onSelect }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  const toggleDate = useCallback((date: string) => {
    setCollapsedDates(prev => ({ ...prev, [date]: !prev[date] }));
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (currentMonth !== 'ALL' && !t.date.startsWith(currentMonth)) return false;
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, currentMonth, typeFilter, search]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, t) => {
      if (!acc[t.date]) acc[t.date] = [];
      acc[t.date].push(t);
      return acc;
    }, {} as Record<string, Transaction[]>);
  }, [filtered]);

  const sortedDates = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  const flatList = useMemo(() => {
    const renderData: { isHeader: boolean; date?: string; transaction?: Transaction }[] = [];
    for (const date of sortedDates) {
      renderData.push({ isHeader: true, date });
      if (!collapsedDates[date]) {
        for (const t of grouped[date]) {
          renderData.push({ isHeader: false, transaction: t });
        }
      }
    }
    return renderData;
  }, [sortedDates, grouped, collapsedDates]);

  if (transactions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-[#121212] pt-2 pb-4 space-y-3">
        <div className="flex bg-[#1E1E1E] p-1 rounded-xl border border-white/10">
          {(['ALL', 'INCOME', 'EXPENSE'] as FilterType[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                typeFilter === t ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1E1E1E] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <Virtuoso
        useWindowScroll
        data={flatList}
        itemContent={(_index, item) => {
          if (item.isHeader) {
            return (
              <DateHeader
                date={item.date!}
                isCollapsed={!!collapsedDates[item.date!]}
                count={grouped[item.date!].length}
                onToggle={toggleDate}
              />
            );
          }
          return <TransactionRow t={item.transaction!} onSelect={onSelect} />;
        }}
        components={{
          List: React.forwardRef((props: any, ref) => (
            <div ref={ref} style={props.style} className="space-y-0.5">
              {props.children}
            </div>
          ))
        }}
      />
    </div>
  );
};
