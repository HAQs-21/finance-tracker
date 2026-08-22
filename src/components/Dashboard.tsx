import React, { useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Navigation, type TabType } from './Navigation';
import { AppHeader } from './AppHeader';
import { WalletView } from './WalletView';
import { BudgetsView } from './BudgetsView';
import { VaultView } from './VaultView';
import { ToolsView } from './ToolsView';
import { AddTransactionSheet } from './AddTransactionSheet';
import { TransactionModal } from './TransactionModal';
import type { Transaction } from '../types';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const {
    transactions,
    savings,
    budgets,
    currentMonth,
    setCurrentMonth,
    availableMonths,
    monthlyStats,
    lifetimeStats,
    categoryStats,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addSavings,
    deleteSavings,
    setBudget,
    deleteBudget
  } = useFinance();

  return (
    <div className="space-y-4 pb-24">
      {/* Top Header */}
      <AppHeader
        activeTab={activeTab}
        currentMonth={currentMonth}
        availableMonths={availableMonths}
        onMonthChange={setCurrentMonth}
        onOpenSync={() => setActiveTab('tools')}
      />

      {/* Main Tab Content */}
      <main className="min-h-[400px]">
        {activeTab === 'wallet' && (
          <WalletView
            transactions={transactions}
            currentMonth={currentMonth}
            monthlyStats={monthlyStats}
            lifetimeStats={lifetimeStats}
            onSelectTransaction={setSelectedTransaction}
            onOpenAdd={() => setIsAddOpen(true)}
            onOpenVault={() => setActiveTab('vault')}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetsView
            stats={categoryStats}
            budgets={budgets}
            currentMonth={currentMonth}
            onSetBudget={setBudget}
            onDeleteBudget={deleteBudget}
          />
        )}

        {activeTab === 'vault' && (
          <VaultView
            savingsRecords={savings}
            walletBalance={lifetimeStats.balance}
            onAddSavings={addSavings}
            onDeleteSavings={deleteSavings}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsView
            transactions={transactions}
            onFinishImport={() => setActiveTab('wallet')}
          />
        )}
      </main>

      {/* Bottom Tab Bar Navigation */}
      <Navigation activeTab={activeTab} onChange={setActiveTab} />

      {/* Add Transaction Bottom Sheet */}
      <AddTransactionSheet
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={addTransaction}
      />

      {/* Transaction Details & Insights Sheet */}
      <TransactionModal
        transaction={selectedTransaction}
        allTransactions={transactions}
        onClose={() => setSelectedTransaction(null)}
        onUpdate={updateTransaction}
        onDelete={deleteTransaction}
      />
    </div>
  );
};
