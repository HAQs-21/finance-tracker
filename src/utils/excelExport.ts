import * as XLSX from 'xlsx';
import type { Transaction, SavingsRecord } from '../types';
import { isPureTransaction } from '../db/financeUtils';

export function exportToExcel(
  transactions: Transaction[],
  savings: SavingsRecord[] = []
): void {
  const validTransactions = transactions.filter(isPureTransaction);
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: ALL TRANSACTIONS ---
  const txRows = validTransactions.map((t) => ({
    Date: t.date,
    Type: t.type,
    Category: t.category,
    'Amount (PKR)': t.amount,
    Description: t.description || t.category
  }));

  const wsTransactions = XLSX.utils.json_to_sheet(txRows.length > 0 ? txRows : [{
    Date: '',
    Type: '',
    Category: '',
    'Amount (PKR)': 0,
    Description: 'No transactions recorded'
  }]);

  // Set column widths
  wsTransactions['!cols'] = [
    { wch: 14 }, // Date
    { wch: 10 }, // Type
    { wch: 18 }, // Category
    { wch: 16 }, // Amount
    { wch: 32 }  // Description
  ];
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');

  // --- SHEET 2: MONTHLY SUMMARY WITH LIVE FORMULAS ---
  const monthSet = new Set<string>();
  validTransactions.forEach((t) => monthSet.add(t.date.slice(0, 7)));
  savings.forEach((s) => monthSet.add(s.date.slice(0, 7)));
  const sortedMonths = Array.from(monthSet).sort((a, b) => a.localeCompare(b));

  const monthRows = sortedMonths.map((m) => {
    const monthTx = validTransactions.filter((t) => t.date.startsWith(m));
    const monthSavings = savings.filter((s) => s.date.startsWith(m));

    const income = monthTx
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = monthTx
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const saved = monthSavings.reduce(
      (sum, s) => (s.type === 'DEPOSIT' ? sum + s.amount : sum - s.amount),
      0
    );

    return {
      Month: m,
      'Income (PKR)': income,
      'Expense (PKR)': expense,
      'Saved (PKR)': saved,
      'In Hand (PKR)': income - expense - saved,
      'Total Cash (PKR)': income - expense
    };
  });

  const wsMonthly = XLSX.utils.json_to_sheet(monthRows.length > 0 ? monthRows : [{
    Month: '',
    'Income (PKR)': 0,
    'Expense (PKR)': 0,
    'Saved (PKR)': 0,
    'In Hand (PKR)': 0,
    'Total Cash (PKR)': 0
  }]);

  wsMonthly['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Summary');

  // --- SHEET 3: CATEGORY SPENDING ---
  const categoryTotals: Record<string, number> = {};
  let totalExpenseAllTime = 0;

  validTransactions
    .filter((t) => t.type === 'EXPENSE')
    .forEach((t) => {
      const cat = t.category.trim() || 'General';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
      totalExpenseAllTime += t.amount;
    });

  const categoryRows = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, total]) => ({
      Category: cat,
      'Total Spent (PKR)': total,
      'Share (%)': totalExpenseAllTime > 0 ? +((total / totalExpenseAllTime) * 100).toFixed(2) : 0
    }));

  const wsCategories = XLSX.utils.json_to_sheet(categoryRows.length > 0 ? categoryRows : [{
    Category: '',
    'Total Spent (PKR)': 0,
    'Share (%)': 0
  }]);

  wsCategories['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCategories, 'Category Breakdown');

  // --- SHEET 4: SAVINGS LOG ---
  const savingsRows = savings.map((s) => ({
    Date: s.date,
    Type: s.type,
    'Amount (PKR)': s.amount,
    Description: s.description || (s.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal')
  }));

  const wsSavings = XLSX.utils.json_to_sheet(savingsRows.length > 0 ? savingsRows : [{
    Date: '',
    Type: '',
    'Amount (PKR)': 0,
    Description: 'No savings history recorded'
  }]);

  wsSavings['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSavings, 'Savings Log');

  // Trigger Excel File Download
  const filename = `finance_tracker_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
