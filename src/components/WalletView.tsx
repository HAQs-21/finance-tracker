import React, { useState, useMemo, useCallback, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { 
  Plus, 
  Search, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronRight, 
  PiggyBank, 
  TrendingUp, 
  TrendingDown,
  Wallet
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
        className="w-full flex items-center justify-between p-3.5 bg-[#121216] border border-white/5 active:bg-[#181820] text-left cursor-pointer rounded-2xl transition-all duration-150 pressable"
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

  const toggleDate = useCallback((date: string) => {
    setCollapsedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  }, []);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (currentMonth !== 'ALL' && !t.date.startsWith(currentMonth)) return false;
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
  }, [transactions, currentMonth, typeFilter, search]);

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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Hero Liquid Balance Card */}
      <section className="bg-gradient-to-br from-[#181126] via-[#121019] to-[#0c0c0f] p-5 sm:p-6 rounded-[28px] border border-violet-500/20 shadow-xl shadow-black/60 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] text-white pointer-events-none">
          <Wallet size={130} />
        </div>

        <div className="flex flex-col gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{currentMonth === 'ALL' ? 'Total Balance' : 'Balance'}</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
              <AnimatedNumber value={monthlyStats.balance} />
            </div>
          </div>

          {/* Interactive Vault Bridge Capsule */}
          <div
            onClick={onOpenVault}
            className="cursor-pointer p-3 rounded-2xl bg-[#0e0c14]/80 border border-violet-500/25 hover:border-violet-500/40 flex items-center justify-between group transition-all pressable"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
                <PiggyBank size={16} />
              </div>
              <div>
                <div className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">
                  Savings Reserve
                </div>
                <div className="text-xs font-black text-white">
                  {formatCurrency(lifetimeStats.vaultBalance)}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-violet-400 group-hover:translate-x-0.5 transition-transform pr-1">
              Vault →
            </span>
          </div>
        </div>
      </section>

      {/* Asymmetric 2+1 Cashflow Metrics */}
      <div className="space-y-2.5">
        {/* Row 1: Income & Spending */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-4 rounded-2xl bg-[#101014] border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <span>Income</span>
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp size={13} />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-emerald-400 truncate">
                <AnimatedNumber value={monthlyStats.totalIncome} />
              </div>
              <p className="text-[9px] text-zinc-500 font-medium tracking-wide mt-0.5">Earnings</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#101014] border border-rose-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <span>Spending</span>
              <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingDown size={13} />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-rose-400 truncate">
                <AnimatedNumber value={monthlyStats.totalExpense} />
              </div>
              <p className="text-[9px] text-zinc-500 font-medium tracking-wide mt-0.5">Expenses</p>
            </div>
          </div>
        </div>

        {/* Row 2: Full Width Savings Movement */}
        <div
          onClick={onOpenVault}
          className="p-3.5 rounded-2xl bg-[#101014] border border-violet-500/25 flex items-center justify-between cursor-pointer pressable"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/15 text-violet-300">
              <PiggyBank size={15} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Monthly Savings
              </div>
              <div className="text-sm font-black text-violet-300">
                <AnimatedNumber value={monthlyStats.totalSavings} />
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-violet-400">
            {monthlyStats.totalSavings >= 0 ? 'Allocated' : 'Withdrawn'} →
          </span>
        </div>
      </div>

      {/* Lifetime Wealth Matrix */}
      <section className="p-4 rounded-2xl bg-[#101014] border border-white/5 space-y-2.5">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-0.5">
          All-Time Overview
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[#16161c]/70 border border-white/5">
            <div className="text-[9px] font-bold text-zinc-500 uppercase">Cash</div>
            <div className="text-xs font-black text-zinc-200 mt-0.5">{formatCurrency(lifetimeStats.balance)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#16161c]/70 border border-violet-500/15">
            <div className="text-[9px] font-bold text-violet-400/80 uppercase">Vault</div>
            <div className="text-xs font-black text-violet-300 mt-0.5">{formatCurrency(lifetimeStats.vaultBalance)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#16161c]/70 border border-emerald-500/15">
            <div className="text-[9px] font-bold text-emerald-500/80 uppercase">Earned</div>
            <div className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrency(lifetimeStats.totalIncome)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#16161c]/70 border border-rose-500/15">
            <div className="text-[9px] font-bold text-rose-500/80 uppercase">Spent</div>
            <div className="text-xs font-black text-rose-400 mt-0.5">{formatCurrency(lifetimeStats.totalExpense)}</div>
          </div>
        </div>
      </section>

      {/* Transaction Feed Section */}
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
                className="w-full bg-[#16161c] border border-white/5 focus:border-primary/40 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none transition-colors"
              />
            </div>

            <div className="relative shrink-0 flex items-center">
              <select
                value={sortType}
                onChange={(e) => setSortType(e.target.value as SortType)}
                className="appearance-none bg-[#16161c] border border-white/5 focus:border-primary/40 rounded-xl py-2 pl-7 pr-7 text-xs font-bold text-zinc-300 outline-none cursor-pointer"
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

        {/* List Content */}
        {flatList.length > 0 ? (
          <Virtuoso
            useWindowScroll
            data={flatList}
            overscan={400}
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
          <div className="p-8 text-center bg-[#101014] rounded-2xl border border-white/5 space-y-2 mt-2">
            <div className="w-10 h-10 rounded-full bg-white/5 text-zinc-500 flex items-center justify-center mx-auto">
              <Wallet size={18} />
            </div>
            <div className="text-xs font-bold text-zinc-400">No transactions recorded</div>
            <p className="text-[10px] text-zinc-600">Tap the + button below to log your first entry</p>
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
