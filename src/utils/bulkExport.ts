import type { Transaction, SavingsRecord } from '../types';
import { isPureTransaction } from '../db/financeUtils';

export function exportTransactionsToText(
  transactions: Transaction[],
  savings: SavingsRecord[] = []
): string {
  const validTransactions = transactions.filter(isPureTransaction);
  if (validTransactions.length === 0 && savings.length === 0) return '';

  // Group by year and month
  const monthSet = new Set<string>();
  validTransactions.forEach((t) => monthSet.add(t.date.slice(0, 7)));
  savings.forEach((s) => monthSet.add(s.date.slice(0, 7)));

  const sortedMonths = Array.from(monthSet).sort((a, b) => a.localeCompare(b));
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  let output = "";
  
  sortedMonths.forEach((key, index) => {
    const [year, month] = key.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = monthNames[monthIndex] || month;
    
    if (index > 0) output += "\n\n";
    output += `${monthName} ${year}\n`;
    
    const monthTx = validTransactions.filter((t) => t.date.startsWith(key));
    const monthSavings = savings.filter((s) => s.date.startsWith(key));

    const incomes = monthTx.filter(t => t.type === 'INCOME');
    const expenses = monthTx.filter(t => t.type === 'EXPENSE');
    
    // Incomes
    if (incomes.length > 0) {
      const incomeExpressions = incomes.map(t => {
        if (t.amount >= 1000 && t.amount % 1000 === 0) {
          return `${t.amount / 1000}k`;
        }
        return t.amount.toString();
      });
      output += `(${incomeExpressions.join('+')})\n`;
    }

    // Savings
    monthSavings.forEach(s => {
      let amtStr = s.amount.toString();
      if (s.amount >= 1000 && s.amount % 1000 === 0) {
        amtStr = `${s.amount / 1000}k`;
      }
      const sign = s.type === 'DEPOSIT' ? '+' : '-';
      const desc = s.description?.trim() || (s.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal');
      output += `${sign}${amtStr} ${desc} [Savings]\n`;
    });
    
    // Expenses
    expenses.forEach(t => {
      let amtStr = t.amount.toString();
      if (t.amount >= 1000 && t.amount % 1000 === 0) {
        amtStr = `${t.amount / 1000}k`;
      }
      
      let desc = (t.description || t.category || '').trim();
      const cat = (t.category || '').trim();

      // Clean any existing duplicate brackets from description
      desc = desc.replace(/\s*\[[a-zA-Z\s:]+\]\s*$/, '').trim();

      if (cat && cat !== 'Income' && cat !== 'Savings') {
        output += `${amtStr} ${desc} [${cat}]\n`;
      } else {
        output += `${amtStr} ${desc}\n`;
      }
    });
  });
  
  return output.trim();
}
