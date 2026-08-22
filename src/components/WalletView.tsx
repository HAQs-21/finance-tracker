import React, { useState, useMemo, useCallback, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { 
  Plus, 
  Search, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight, 
  PiggyBank, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Landmark, 
  Wallet,
  Coins
} from 'lucide-react';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { SegmentedControl } from './ui/SegmentedControl';
import { getCategoryIcon } from '../utils/categories';
import { formatCurrency } from '../db/financeUtils';
import type { Transaction, SummaryStats } from '../types';

interface WalletViewProps {
  transactions: Transaction[];
  currentMonth: string;
  monthlyStats: SummaryStats;
  lifetimeStats: SummaryStats;
  onSelectTransaction: (t: Transaction) => void;
  onOpenAdd: () => void;
  onOpenVault: () => void;
}

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE';
type SortType = 'DATE' | 'HIGH' | 'LOW' | 'FREQUENT';

// Memoized Transaction Row Component
const TransactionRow = memo(
  ({ t, onSelect }: { t: Transaction; onSelect: (t: Transaction) => void }) => {
    const Icon = getCategoryIcon(t.category);

    return (
      <button
        onClick={() => onSelect(t)}
        className="w-full flex items-center justify-between p-3.5 bg-[#101014] border border-white/5 active:bg-[#16161c] text-left cursor-pointer rounded-2xl transition-all duration-150 pressable"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              t.type === 'INCOME'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            <Icon size={16} />
          </div>
          <div className="truncate">
            <div className="text-sm font-bold text-zinc-100 truncate">
              {t.description || t.category}
            </div>
            <div className="text-[10px] font-semibold text-zinc-500 truncate mt-0.5">
              {t.category}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0 ml-3">
          <div
            className={`text-sm font-black tabular-nums ${
              t.type === 'INCOME' ? 'text-emerald-400' : 'text-zinc-100'
            }`}
          >
            {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount)}
          </div>
          <div className="text-[9px] font-mono text-zinc-500 mt-0.5">{t.date}</div>
        </div>
      </button>
    );
  }
);

// Memoized Sticky Date Header Component
const DateHeader = memo(
  ({
    date,
    isCollapsed,
    count,
    onToggle
  }: {
    date: string;
    isCollapsed: boolean;
    count: number;
    onToggle: (d: string) => void;
  }) => {
    const dateObj = new Date(`${date}T00:00:00`);
    return (
      <button
        onClick={() => onToggle(date)}
        className="w-full flex items-center justify-between py-2 px-1 mt-3 bg-transparent outline-none cursor-pointer group select-none"
      >
        <div className="flex items-center gap-1.5 text-zinc-400">
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">
            {dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>
        <span className="text-[9px] font-bold text-zinc-600 bg-white/[0.03] px-2 py-0.5 rounded-md">
          {count} {count === 1 ? 'record' : 'records'}
        </span>
      </button>
    );
  }
);

export const WalletView: React.FC<WalletViewProps> = ({
  transactions,
  currentMonth,
  monthlyStats,
  lifetimeStats,
  onSelectTransaction,
  onOpenAdd,
  onOpenVault
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
  const [sortType, setSortType] = useState<SortType>('DATE');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [showTotalCash, setShowTotalCash] = useState(false);

  const toggleDate = useCallback((date: string) => {
    setCollapsedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  }, []);

  const isAllTime = currentMonth === 'ALL';

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!isAllTime && !t.date.startsWith(currentMonth)) return false;
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (
        search &&
        !t.description.toLowerCase().includes(search.toLowerCase()) &&
        !t.category.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, currentMonth, isAllTime, typeFilter, search]);

  // Sort transactions
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

  // Flatten items for Virtuoso
  const flatList = useMemo(() => {
    type RenderItem = {
      isHeader: boolean;
      date?: string;
      transaction?: Transaction;
      count?: number;
    };
    const renderData: RenderItem[] = [];

    if (sortType !== 'DATE') {
      return sortedList.map((t) => ({ isHeader: false, transaction: t } as RenderItem));
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

  // Financial values:
  const balance = lifetimeStats.balance;
  const totalCash = lifetimeStats.totalCash;
  const displayIncome = isAllTime ? lifetimeStats.totalIncome : monthlyStats.totalIncome;
  const displayExpense = isAllTime ? lifetimeStats.totalExpense : monthlyStats.totalExpense;
  const displaySavings = isAllTime ? lifetimeStats.totalSavings : monthlyStats.totalSavings;
  const displayTax = isAllTime ? lifetimeStats.totalTax : monthlyStats.totalTax;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* --- SIMPLIFIED FINANCIAL HEADER --- */}
      <section className="bg-gradient-to-b from-[#1b152d] via-[#120e20] to-[#0a0812] p-5 rounded-3xl border border-violet-500/30 shadow-2xl shadow-violet-950/30 space-y-4">
        {/* Top: Balance */}
        <div>
          <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Balance</span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1 drop-shadow-md">
            <AnimatedNumber value={balance} />
          </div>
        </div>

        {/* 4 Subordinate Columns: Income, Spending, Savings, Tax */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5">
          {/* Income */}
          <div className="p-3 rounded-2xl bg-[#101014]/90 border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold uppercase">
              <ArrowUpRight size={12} /> Income
            </div>
            <div className="text-xs sm:text-sm font-black text-emerald-400 mt-1 truncate">
              <AnimatedNumber value={displayIncome} />
            </div>
          </div>

          {/* Spending */}
          <div className="p-3 rounded-2xl bg-[#101014]/90 border border-rose-500/20 flex flex-col justify-between">
            <div className="flex items-center gap-1 text-rose-400 text-[10px] font-bold uppercase">
              <ArrowDownLeft size={12} /> Spending
            </div>
            <div className="text-xs sm:text-sm font-black text-rose-400 mt-1 truncate">
              <AnimatedNumber value={displayExpense} />
            </div>
          </div>

          {/* Savings */}
          <div
            onClick={onOpenVault}
            className="p-3 rounded-2xl bg-[#101014]/90 border border-violet-500/25 cursor-pointer hover:border-violet-500/50 transition-colors pressable flex flex-col justify-between"
          >
            <div className="flex items-center gap-1 text-violet-400 text-[10px] font-bold uppercase">
              <PiggyBank size={12} /> Savings
            </div>
            <div className="text-xs sm:text-sm font-black text-violet-300 mt-1 truncate">
              <AnimatedNumber value={displaySavings} />
            </div>
          </div>

          {/* Tax */}
          <div className="p-3 rounded-2xl bg-[#101014]/90 border border-amber-500/25 flex flex-col justify-between">
            <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold uppercase">
              <Landmark size={12} /> Tax
            </div>
            <div className="text-xs sm:text-sm font-black text-amber-300 mt-1 truncate">
              <AnimatedNumber value={displayTax} />
            </div>
          </div>
        </div>

        {/* Horizontal Dropdown Field: Total amount */}
        <div className="pt-1 border-t border-white/5">
          <button
            type="button"
            onClick={() => setShowTotalCash((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#101014]/80 hover:bg-[#15151c] border border-white/5 hover:border-white/10 transition-all cursor-pointer pressable select-none group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Coins size={13} />
              </div>
              <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">
                Total amount
              </span>
            </div>

            <div className="flex items-center gap-2">
              {showTotalCash ? (
                <span className="text-xs sm:text-sm font-black text-emerald-400 tabular-nums">
                  {formatCurrency(totalCash)}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
                  Tap to view <ChevronDown size={13} />
                </span>
              )}
              {showTotalCash && <ChevronUp size={13} className="text-zinc-400" />}
            </div>
          </button>
        </div>
      </section>

      {/* --- TRANSACTIONS FEED SECTION --- */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-white uppercase tracking-wider">Transactions</h3>
          <span className="text-[10px] font-bold text-zinc-500">{filtered.length} total</span>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-2">
          <SegmentedControl<FilterType>
            size="sm"
            options={[
              { id: 'ALL', label: 'All' },
              { id: 'INCOME', label: 'Income', activeColor: 'bg-emerald-500 text-white' },
              { id: 'EXPENSE', label: 'Spending', activeColor: 'bg-rose-500 text-white' }
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
          />

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#141418] border border-white/5 focus:border-primary/40 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none transition-colors"
              />
            </div>

            <div className="relative shrink-0 flex items-center">
              <select
                value={sortType}
                onChange={(e) => setSortType(e.target.value as SortType)}
                className="appearance-none bg-[#141418] border border-white/5 focus:border-primary/40 rounded-xl py-2 pl-7 pr-7 text-xs font-bold text-zinc-300 outline-none cursor-pointer"
              >
                <option value="DATE">Date</option>
                <option value="HIGH">High</option>
                <option value="LOW">Low</option>
                <option value="FREQUENT">Freq</option>
              </select>
              <ArrowUpDown size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Virtuoso Feed */}
        {flatList.length > 0 ? (
          <Virtuoso
            useWindowScroll
            data={flatList}
            overscan={300}
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
              return (
                <div className="mb-2">
                  <TransactionRow t={item.transaction!} onSelect={onSelectTransaction} />
                </div>
              );
            }}
          />
        ) : (
          <div className="p-8 text-center bg-[#101014] rounded-3xl border border-white/5 space-y-3 mt-2">
            <div className="w-12 h-12 rounded-2xl bg-white/5 text-zinc-500 flex items-center justify-center mx-auto">
              <Wallet size={20} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-black text-zinc-300">No records found</div>
              <p className="text-xs text-zinc-500">Tap + to log an expense or restore from Cloud</p>
            </div>
          </div>
        )}
      </section>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={onOpenAdd}
        className="fixed bottom-22 right-5 z-40 w-13 h-13 rounded-2xl bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-2xl shadow-primary/40 border border-primary/50 cursor-pointer pressable"
        aria-label="Add transaction"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
    </div>
  );
};
