import type { Transaction } from '../types';

export function exportTransactionsToText(transactions: Transaction[]): string {
  if (transactions.length === 0) return '';

  // Sort by date ascending (oldest first)
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  
  // Group by year and month
  const groups: Record<string, Transaction[]> = {};
  sorted.forEach(t => {
    const key = t.date.slice(0, 7); // e.g. "2026-06"
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  let output = "";
  
  const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  keys.forEach(key => {
    const [year, month] = key.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = monthNames[monthIndex] || month;
    
    output += `${monthName} ${year}\n`;
    
    const incomes = groups[key].filter(t => t.type === 'INCOME');
    const expenses = groups[key].filter(t => t.type === 'EXPENSE');
    
    if (incomes.length > 0) {
      const incomeExpressions = incomes.map(t => {
        // check if amount is a multiple of 1000, express in 'k'
        if (t.amount >= 1000 && t.amount % 1000 === 0) {
          return `${t.amount / 1000}k`;
        }
        return t.amount.toString();
      });
      output += `(${incomeExpressions.join('+')})\n`;
    }
    
    expenses.forEach(t => {
      let amtStr = t.amount.toString();
      if (t.amount >= 1000 && t.amount % 1000 === 0) {
        amtStr = `${t.amount / 1000}k`;
      }
      output += `${amtStr} ${t.description || t.category}\n`;
    });
    
    output += `\n`;
  });
  
  return output.trim();
}
