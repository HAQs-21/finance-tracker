import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  calculateOverallStats,
  calculateMonthlyStats,
  calculateCategoryDistribution,
  isPureTransaction
} from '../db/financeUtils';
import type { Transaction, SavingsRecord, Budget } from '../types';

export function useFinance() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Live queries for tables
  const allTransactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().toArray(),
    []
  ) ?? [];

  const allSavings = useLiveQuery(
    () => db.savings.orderBy('date').reverse().toArray(),
    []
  ) ?? [];

  const allBudgets = useLiveQuery(
    () => db.budgets.toArray(),
    []
  ) ?? [];

  // Filter only genuine transactions (excludes any legacy savings records)
  const transactions = useMemo(
    () => allTransactions.filter(isPureTransaction),
    [allTransactions]
  );

  const lifetimeStats = useMemo(
    () => calculateOverallStats(transactions, allSavings),
    [transactions, allSavings]
  );

  const monthlyStats = useMemo(
    () => calculateMonthlyStats(transactions, allSavings, currentMonth),
    [transactions, allSavings, currentMonth]
  );

  const categoryStats = useMemo(
    () => calculateCategoryDistribution(transactions, currentMonth),
    [transactions, currentMonth]
  );

  const availableMonths = useMemo(() => {
    const currentRealMonth = new Date().toISOString().slice(0, 7);
    const months = new Set<string>();
    transactions.forEach((t) => months.add(t.date.slice(0, 7)));
    allSavings.forEach((s) => months.add(s.date.slice(0, 7)));
    months.add(currentRealMonth);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions, allSavings]);

  return {
    transactions,
    savings: allSavings,
    budgets: allBudgets,
    currentMonth,
    setCurrentMonth,
    availableMonths,
    monthlyStats,
    lifetimeStats,
    categoryStats,
    // Database helpers
    addTransaction: async (data: Omit<Transaction, 'id'>) => {
      return await db.transactions.add(data);
    },
    updateTransaction: async (id: number, data: Partial<Transaction>) => {
      return await db.transactions.update(id, data);
    },
    deleteTransaction: async (id: number) => {
      return await db.transactions.delete(id);
    },
    addSavings: async (data: Omit<SavingsRecord, 'id'>) => {
      return await db.savings.add(data);
    },
    deleteSavings: async (id: number) => {
      return await db.savings.delete(id);
    },
    setBudget: async (data: Budget) => {
      return await db.budgets.put(data);
    },
    deleteBudget: async (category: string) => {
      return await db.budgets.delete(category);
    }
  };
}
