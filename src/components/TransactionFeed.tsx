import React, { useState, useMemo, useCallback, memo } from 'react';
import type { Transaction } from '../types';
import { Search, ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '../db/financeUtils';
import { Virtuoso } from 'react-virtuoso';
import { getCategoryIcon } from '../utils/categories';

interface TransactionFeedProps {
  transactions: Transaction[];
  currentMonth: string;
  onSelect: (t: Transaction) => void;
}

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE';
type SortType = 'DATE' | 'HIGH' | 'LOW' | 'FREQUENT';

const TransactionRow = memo(({ t, onSelect }: { t: Transaction, onSelect: (t: Transaction) => void }) => {
  const Icon = getCategoryIcon(t.category);

  return (
    <button 
      onClick={() => onSelect(t)}
      className="w-full flex items-center justify-between p-4 bg-[#1E1E1E] border border-white/10 active:bg-[#2A2A2A] text-left cursor-pointer rounded-2xl animate-row-fade-in transform origin-center active:scale-95 transition-[background-color,transform,border-color] duration-150"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`p-2 rounded-lg shrink-0 ${t.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          <Icon size={14} />
        </div>
        <div className="truncate">
          <div className="text-sm font-semibold text-zinc-200 truncate">{t.description || t.category}</div>
          <div className="text-[10px] font-medium text-zinc-500 truncate">{t.category}</div>
        </div>
      </div>
      <div className={`flex flex-col items-end shrink-0 ml-4`}>
        <div className={`text-sm font-bold ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-zinc-100'}`}>
          {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount)}
        </div>
        <div className="text-[9px] font-mono text-zinc-500">{t.date}</div>
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
  const [sortType, setSortType] = useState<SortType>('DATE');
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

  const sortedList = useMemo(() => {
    if (sortType === 'DATE') return filtered;
    
    const list = [...filtered];
    if (sortType === 'HIGH') return list.sort((a, b) => b.amount - a.amount);
    if (sortType === 'LOW') return list.sort((a, b) => a.amount - b.amount);
    
    if (sortType === 'FREQUENT') {
      const freqs = transactions.reduce((acc, t) => {
        const key = (t.description || t.category).trim().toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return list.sort((a, b) => {
        const keyA = (a.description || a.category).trim().toLowerCase();
        const keyB = (b.description || b.category).trim().toLowerCase();
        return (freqs[keyB] || 0) - (freqs[keyA] || 0);
      });
    }
    return list;
  }, [filtered, sortType, transactions]);

  const flatList = useMemo(() => {
    type RenderItem = { isHeader: boolean; date?: string; transaction?: Transaction; count?: number };
    const renderData: RenderItem[] = [];
    
    if (sortType !== 'DATE') {
      return sortedList.map(t => ({ isHeader: false, transaction: t } as RenderItem));
    }

    const grouped = sortedList.reduce((acc, t) => {
      if (!acc[t.date]) acc[t.date] = [];
      acc[t.date].push(t);
      return acc;
    }, {} as Record<string, Transaction[]>);

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    
    for (const date of sortedDates) {
      renderData.push({ isHeader: true, date, count: grouped[date].length });
      if (!collapsedDates[date]) {
        for (const t of grouped[date]) {
          renderData.push({ isHeader: false, transaction: t });
        }
      }
    }
    return renderData;
  }, [sortedList, sortType, collapsedDates]);

  if (transactions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-[#121212] pt-2 pb-4 space-y-3">
        <div className="flex bg-[#1E1E1E] p-1 rounded-xl border border-white/10">
          {(['ALL', 'INCOME', 'EXPENSE'] as FilterType[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg cursor-pointer btn-pop ${
                typeFilter === t ? 'bg-white text-black shadow-sm shadow-white/5' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/25 border border-white/5 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-xl py-2.5 pl-9 pr-4 text-xs text-zinc-200 transition-all placeholder:text-zinc-650 outline-none"
            />
          </div>
          <div className="relative shrink-0 flex items-center">
            <select
              value={sortType}
              onChange={e => setSortType(e.target.value as SortType)}
              className="appearance-none bg-black/25 border border-white/5 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-xl py-2.5 pl-8.5 pr-8 text-xs font-semibold text-zinc-200 transition-all outline-none h-full cursor-pointer"
            >
              <option value="DATE">Date</option>
              <option value="HIGH">High</option>
              <option value="LOW">Low</option>
              <option value="FREQUENT">Freq</option>
            </select>
            <ArrowUpDown size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <Virtuoso
        useWindowScroll
        data={flatList}
        overscan={500}
        itemContent={(_index, item) => {
          if (item.isHeader) {
            return (
              <DateHeader
                date={item.date!}
                isCollapsed={!!collapsedDates[item.date!]}
                count={item.count!}
                onToggle={toggleDate}
              />
            );
          }
          return <TransactionRow t={item.transaction!} onSelect={onSelect} />;
        }}
        components={{
          List: React.forwardRef((props: any, ref) => (
            <div ref={ref} style={props.style} className="space-y-2.5">
              {props.children}
            </div>
          ))
        }}
      />
    </div>
  );
};
