import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Transaction } from '../types';
import { SummaryCard } from './ui/SummaryCard';
import { TransactionFeed } from './TransactionFeed';
import { BulkImporter } from './BulkImporter';
import { BulkExporter } from './BulkExporter';
import { SyncSettings } from './SyncSettings';
import { BudgetVariance } from './BudgetVariance';
import { MonthSelector } from './MonthSelector';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { SavingsVault } from './SavingsVault';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank, 
  Target, 
  Settings, 
  Plus,
  ChevronDown,
  Cloud,
  FileText,
  FileDown
} from 'lucide-react';
import { calculateOverallStats, calculateMonthlyStats, calculateCategoryDistribution, formatCurrency } from '../db/financeUtils';
import { AddTransactionModal } from './AddTransactionModal';

type Tab = 'wallet' | 'budgets' | 'vault' | 'sync';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('wallet');
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openTool, setOpenTool] = useState<'sync' | 'import' | 'export' | null>('sync');

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

  const [isFeedReady, setIsFeedReady] = useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => setIsFeedReady(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // Header content helper based on active tab
  const tabHeader = useMemo(() => {
    switch (activeTab) {
      case 'wallet':
        return { title: 'My Wallet', subtitle: 'Tracking your wealth' };
      case 'budgets':
        return { title: 'Budgets', subtitle: 'Category limits and variance' };
      case 'vault':
        return { title: 'Savings Vault', subtitle: 'Secure and grow your wealth' };
      case 'sync':
        return { title: 'Tools & Sync', subtitle: 'Import and backup options' };
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 pb-28">
      {/* App Header */}
      <header className="flex flex-col gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">{tabHeader.title}</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-0.5">{tabHeader.subtitle}</p>
        </div>
      </header>

      {/* Month Selector for Wallet and Budgets tab */}
      {(activeTab === 'wallet' || activeTab === 'budgets') && (
        <MonthSelector 
          currentMonth={currentMonth} 
          availableMonths={availableMonths} 
          onChange={setCurrentMonth} 
        />
      )}

      {/* Main content viewport switching using CSS for 60fps animations */}
      <main className="relative min-h-[300px]">
        {activeTab === 'wallet' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-250">
            {/* Monthly Balance Card */}
            <section className="bg-gradient-to-br from-[#1E1E1E] to-[#141414] p-6 rounded-2xl border border-white/10 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 p-8 opacity-5 text-white">
                <Wallet size={120} />
              </div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                {currentMonth === 'ALL' ? 'All Time Balance' : 'Monthly Balance'}
              </p>
              <div className="text-4xl font-black text-white tracking-tighter">
                {formatCurrency(monthlyStats.balance)}
              </div>
            </section>

            {/* Income & Expense Summary Cards */}
            <section className="grid grid-cols-2 gap-4">
              <SummaryCard 
                title="Income" 
                value={monthlyStats.totalIncome} 
                type="income" 
                icon={<TrendingUp size={14} />}
              />
              <SummaryCard 
                title="Expenses" 
                value={monthlyStats.totalExpense} 
                type="expense" 
                icon={<TrendingDown size={14} />}
              />
            </section>

            {/* Lifetime Summary Stats Grid */}
            <section className="grid grid-cols-3 gap-2 bg-[#1E1E1E] p-3.5 rounded-xl border border-white/5">
              <div className="text-center border-r border-white/5">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Life Bal</div>
                <div className="text-xs font-black text-zinc-200 mt-0.5">{formatCurrency(lifetimeStats.balance)}</div>
              </div>
              <div className="text-center border-r border-white/5">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Life Inc</div>
                <div className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrency(lifetimeStats.totalIncome)}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Life Exp</div>
                <div className="text-xs font-black text-rose-400 mt-0.5">{formatCurrency(lifetimeStats.totalExpense)}</div>
              </div>
            </section>

            {/* Virtualized Transaction Feed */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Transactions Feed</h3>
              {isFeedReady ? (
                <TransactionFeed 
                  transactions={transactions} 
                  currentMonth={currentMonth} 
                  onSelect={setSelectedTransaction} 
                />
              ) : (
                <div className="flex justify-center items-center h-32">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'budgets' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-250">
            <BudgetVariance stats={categoryStats} />
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-250">
            <SavingsVault />
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-250">
            {/* Accordion Item 1: Cloud Sync */}
            <div className={`glass-panel rounded-2xl overflow-hidden spring-pop border ${
              openTool === 'sync' 
                ? 'border-violet-500/35 bg-violet-950/[0.04] shadow-lg shadow-violet-500/5' 
                : 'border-violet-500/15 bg-white/[0.01] hover:border-violet-500/30 hover:bg-violet-950/[0.01] hover:shadow-lg hover:shadow-violet-500/5 card-hover-pop'
            }`}>
              <button
                onClick={() => setOpenTool(openTool === 'sync' ? null : 'sync')}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    openTool === 'sync' 
                      ? 'bg-violet-500/25 text-violet-300 border border-violet-500/40 scale-105 shadow-md shadow-violet-500/10' 
                      : 'bg-violet-500/10 text-violet-400 border border-violet-500/20 group-hover:bg-violet-500/20 group-hover:text-violet-300 group-hover:scale-102'
                  }`}>
                    <Cloud size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold tracking-tight transition-colors ${
                      openTool === 'sync' ? 'text-violet-300 font-bold' : 'text-zinc-200 group-hover:text-violet-300'
                    }`}>
                      Cloud Vault Sync
                    </h4>
                    <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase mt-0.5">BACKUP & RESTORE DATA</p>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  openTool === 'sync' ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25' : 'text-zinc-500 group-hover:text-violet-400'
                }`}>
                  <ChevronDown size={18} className={`transition-transform duration-500 ${openTool === 'sync' ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                openTool === 'sync' 
                  ? 'grid-rows-[1fr] opacity-100 border-t border-white/5' 
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}>
                <div className="overflow-hidden">
                  <div className="p-6 bg-[#0c0c0f]/80">
                    <SyncSettings />
                  </div>
                </div>
              </div>
            </div>

            {/* Accordion Item 2: Importer */}
            <div className={`glass-panel rounded-2xl overflow-hidden spring-pop border ${
              openTool === 'import' 
                ? 'border-cyan-500/35 bg-cyan-950/[0.04] shadow-lg shadow-cyan-500/5' 
                : 'border-cyan-500/15 bg-white/[0.01] hover:border-cyan-500/30 hover:bg-cyan-950/[0.01] hover:shadow-lg hover:shadow-cyan-500/5 card-hover-pop'
            }`}>
              <button
                onClick={() => setOpenTool(openTool === 'import' ? null : 'import')}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    openTool === 'import' 
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 scale-105 shadow-md shadow-cyan-500/10' 
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 group-hover:scale-102'
                  }`}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold tracking-tight transition-colors ${
                      openTool === 'import' ? 'text-cyan-300 font-bold' : 'text-zinc-200 group-hover:text-cyan-300'
                    }`}>
                      Bulk Data Importer
                    </h4>
                    <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase mt-0.5">PARSE UNSTRUCTURED TEXT</p>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  openTool === 'import' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25' : 'text-zinc-500 group-hover:text-cyan-400'
                }`}>
                  <ChevronDown size={18} className={`transition-transform duration-500 ${openTool === 'import' ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                openTool === 'import' 
                  ? 'grid-rows-[1fr] opacity-100 border-t border-white/5' 
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}>
                <div className="overflow-hidden">
                  <div className="p-6 bg-[#0c0c0f]/80">
                    <BulkImporter onComplete={() => setActiveTab('wallet')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Accordion Item 3: Exporter */}
            <div className={`glass-panel rounded-2xl overflow-hidden spring-pop border ${
              openTool === 'export' 
                ? 'border-emerald-500/35 bg-emerald-950/[0.04] shadow-lg shadow-emerald-500/5' 
                : 'border-emerald-500/15 bg-white/[0.01] hover:border-emerald-500/30 hover:bg-emerald-950/[0.01] hover:shadow-lg hover:shadow-emerald-500/5 card-hover-pop'
            }`}>
              <button
                onClick={() => setOpenTool(openTool === 'export' ? null : 'export')}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    openTool === 'export' 
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 scale-105 shadow-md shadow-emerald-500/10' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 group-hover:scale-102'
                  }`}>
                    <FileDown size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold tracking-tight transition-colors ${
                      openTool === 'export' ? 'text-emerald-300 font-bold' : 'text-zinc-200 group-hover:text-emerald-300'
                    }`}>
                      Bulk Data Exporter
                    </h4>
                    <p className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase mt-0.5">DOWNLOAD NOTEPAD TEXT</p>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  openTool === 'export' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'text-zinc-500 group-hover:text-emerald-400'
                }`}>
                  <ChevronDown size={18} className={`transition-transform duration-500 ${openTool === 'export' ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                openTool === 'export' 
                  ? 'grid-rows-[1fr] opacity-100 border-t border-white/5' 
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}>
                <div className="overflow-hidden">
                  <div className="p-6 bg-[#0c0c0f]/80">
                    <BulkExporter />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) for adding new transactions */}
      {activeTab === 'wallet' && (
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="fixed bottom-20 right-6 bg-primary text-[#121212] p-4 rounded-2xl hover:brightness-110 z-40 group border border-white/10 shadow-lg cursor-pointer btn-pop"
          aria-label="Add transaction"
        >
          <Plus size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      {/* Bottom Tab Bar Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#181818]/90 backdrop-blur-md border-t border-white/10 px-6 py-3 pb-[calc(env(safe-area-inset-bottom)+8px)] flex justify-between items-center z-40 select-none">
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center gap-1.5 spring-pop cursor-pointer active:scale-90 ${
            activeTab === 'wallet' 
              ? 'text-primary scale-105 font-bold tab-pop-active' 
              : 'text-zinc-500 hover:text-zinc-300 tab-pop'
          }`}
        >
          <Wallet size={20} className="transition-transform duration-200" />
          <span className="text-[9px] uppercase tracking-wider">Wallet</span>
        </button>

        <button
          onClick={() => setActiveTab('budgets')}
          className={`flex flex-col items-center gap-1.5 spring-pop cursor-pointer active:scale-90 ${
            activeTab === 'budgets' 
              ? 'text-primary scale-105 font-bold tab-pop-active' 
              : 'text-zinc-500 hover:text-zinc-300 tab-pop'
          }`}
        >
          <Target size={20} className="transition-transform duration-200" />
          <span className="text-[9px] uppercase tracking-wider">Budgets</span>
        </button>

        <button
          onClick={() => setActiveTab('vault')}
          className={`flex flex-col items-center gap-1.5 spring-pop cursor-pointer active:scale-90 ${
            activeTab === 'vault' 
              ? 'text-violet-400 scale-105 font-bold tab-pop-active' 
              : 'text-zinc-500 hover:text-zinc-300 tab-pop'
          }`}
        >
          <PiggyBank size={20} className="transition-transform duration-200" />
          <span className="text-[9px] uppercase tracking-wider">Vault</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex flex-col items-center gap-1.5 spring-pop cursor-pointer active:scale-90 ${
            activeTab === 'sync' 
              ? 'text-primary scale-105 font-bold tab-pop-active' 
              : 'text-zinc-500 hover:text-zinc-300 tab-pop'
          }`}
        >
          <Settings size={20} className="transition-transform duration-200" />
          <span className="text-[9px] uppercase tracking-wider">Tools</span>
        </button>
      </nav>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal 
        transaction={selectedTransaction} 
        onClose={() => setSelectedTransaction(null)} 
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
};
