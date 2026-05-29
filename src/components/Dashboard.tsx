import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Transaction } from '../types';
import { SummaryCard } from './ui/SummaryCard';
import { TransactionFeed } from './TransactionFeed';
import { BulkImporter } from './BulkImporter';
import { SyncSettings } from './SyncSettings';
import { BudgetVariance } from './BudgetVariance';
import { MonthSelector } from './MonthSelector';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { TrendingUp, TrendingDown, Wallet, Database, Cloud } from 'lucide-react';
import { calculateOverallStats, calculateMonthlyStats, calculateCategoryDistribution, formatCurrency } from '../db/financeUtils';

export const Dashboard: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [activePanel, setActivePanel] = useState<'importer' | 'sync' | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const transactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().toArray(),
    []
  ) ?? [];

  const lifetimeStats = useMemo(() => calculateOverallStats(transactions), [transactions]);
  const monthlyStats = useMemo(() => calculateMonthlyStats(transactions, currentMonth), [transactions, currentMonth]);
  const categoryStats = useMemo(() => calculateCategoryDistribution(transactions, currentMonth), [transactions, currentMonth]);

  const availableMonths = useMemo(() => {
    const currentRealMonth = new Date().toISOString().slice(0, 7);
    const months = new Set(transactions.map(t => t.date.slice(0, 7)));
    months.add(currentRealMonth);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const togglePanel = (panel: 'importer' | 'sync') => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">My Wallet</h1>
            <p className="text-zinc-500 text-sm font-medium">Tracking your wealth</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => togglePanel('importer')}
              className={`p-2 rounded-xl border border-white/10 transition-colors ${activePanel === 'importer' ? 'bg-white text-black' : 'bg-[#1E1E1E] text-zinc-400'}`}
              title="Bulk Import"
            >
              <Database size={20} />
            </button>
            <button 
              onClick={() => togglePanel('sync')}
              className={`p-2 rounded-xl border border-white/10 transition-colors ${activePanel === 'sync' ? 'bg-white text-black' : 'bg-[#1E1E1E] text-zinc-400'}`}
              title="Cloud Sync"
            >
              <Cloud size={20} />
            </button>
          </div>
        </div>
      </header>

      {activePanel === 'importer' && (
        <section className="animate-in slide-in-from-top-4 duration-300">
          <BulkImporter onComplete={() => setActivePanel(null)} />
        </section>
      )}

      {activePanel === 'sync' && (
        <section className="animate-in slide-in-from-top-4 duration-300">
          <SyncSettings />
        </section>
      )}

      <MonthSelector currentMonth={currentMonth} availableMonths={availableMonths} onChange={setCurrentMonth} />

      <section className="grid grid-cols-1 gap-4">
        <div className="bg-[#1E1E1E] p-6 rounded-xl border border-white/10 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 p-8 opacity-5">
            <Wallet size={120} />
          </div>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">{currentMonth === 'ALL' ? 'All Time Balance' : 'Monthly Balance'}</p>
          <div className="text-4xl font-extrabold text-white tracking-tighter">
            {formatCurrency(monthlyStats.balance)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SummaryCard 
            title="Income" 
            value={monthlyStats.totalIncome} 
            type="income" 
            icon={<TrendingUp size={16} />}
          />
          <SummaryCard 
            title="Expenses" 
            value={monthlyStats.totalExpense} 
            type="expense" 
            icon={<TrendingDown size={16} />}
          />
        </div>
      </section>

      <section>
        <BudgetVariance stats={categoryStats} />
      </section>

      <section className="grid grid-cols-1 gap-4 mt-8">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#1E1E1E] p-3 rounded-xl border border-white/10 text-center">
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Life Bal</div>
            <div className="text-sm font-bold text-white">{formatCurrency(lifetimeStats.balance)}</div>
          </div>
          <div className="bg-[#1E1E1E] p-3 rounded-xl border border-white/10 text-center">
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Life Inc</div>
            <div className="text-sm font-bold text-emerald-400">{formatCurrency(lifetimeStats.totalIncome)}</div>
          </div>
          <div className="bg-[#1E1E1E] p-3 rounded-xl border border-white/10 text-center">
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Life Exp</div>
            <div className="text-sm font-bold text-rose-400">{formatCurrency(lifetimeStats.totalExpense)}</div>
          </div>
        </div>
      </section>

      <section>
        <TransactionFeed 
          transactions={transactions} 
          currentMonth={currentMonth} 
          onSelect={setSelectedTransaction} 
        />
      </section>

      <TransactionDetailsModal 
        transaction={selectedTransaction} 
        onClose={() => setSelectedTransaction(null)} 
      />
    </div>
  );
};
