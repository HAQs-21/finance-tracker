import type { Transaction, SavingsRecord } from '../types';

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12'
};

const sanitizeText = (text: string): string => {
  return text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00AD]/g, '');
};

const parseVal = (val: string): number => {
  const clean = val.trim().toLowerCase();
  const hasK = clean.endsWith('k');
  const num = parseFloat(clean.replace('k', ''));
  if (isNaN(num)) return 0;
  return hasK ? num * 1000 : num;
};

export interface ParseResult {
  transactions: Transaction[];
  savings: SavingsRecord[];
  failedLines: string[];
}

export async function parseTextToPreview(rawText: string): Promise<ParseResult> {
  const sanitized = sanitizeText(rawText);
  const lines = sanitized.split(/\r?\n/);
  let currentYear = new Date().getFullYear();
  let currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  
  const transactions: Transaction[] = [];
  const savings: SavingsRecord[] = [];
  const failedLines: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lowerLine = trimmed.toLowerCase();

    // Pattern: Month [Year] (IncomeExpression) e.g. "January 2026 (9k+87200)" or "January (80k+10k)"
    const monthIncomeMatch = trimmed.match(/^([a-zA-Z]+)(?:\s+(\d{4}))?\s*\(([\d+k.\s]+)\)/i);
    if (monthIncomeMatch) {
      const monthName = monthIncomeMatch[1].toLowerCase();
      if (MONTHS[monthName]) {
        currentMonth = MONTHS[monthName];
        if (monthIncomeMatch[2]) {
          currentYear = parseInt(monthIncomeMatch[2], 10);
        }
        const expression = monthIncomeMatch[3];
        const parts = expression.split('+');
        parts.forEach(part => {
          const amount = parseVal(part);
          if (amount > 0) {
            transactions.push({
              amount,
              type: 'INCOME',
              category: 'Income',
              date: `${currentYear}-${currentMonth}-01`,
              description: `Income: ${monthIncomeMatch[1]}`
            });
          }
        });
        continue;
      }
    }

    // Pattern: Standalone Income Expression on its own line e.g. "(28600)" or "(9k+87200)" or "Income: (80k)"
    const standaloneIncomeMatch = trimmed.match(/^(?:income:\s*)?\(([\d+k.\s]+)\)$/i);
    if (standaloneIncomeMatch) {
      const expression = standaloneIncomeMatch[1];
      const parts = expression.split('+');
      parts.forEach(part => {
        const amount = parseVal(part);
        if (amount > 0) {
          transactions.push({
            amount,
            type: 'INCOME',
            category: 'Income',
            date: `${currentYear}-${currentMonth}-01`,
            description: `Income`
          });
        }
      });
      continue;
    }

    // Pattern: Simple Month Header, e.g. "January 2026" or "February"
    const monthHeaderMatch = trimmed.match(/^([a-zA-Z]+)(?:\s+(\d{4}))?$/i);
    if (monthHeaderMatch) {
      const monthName = monthHeaderMatch[1].toLowerCase();
      if (MONTHS[monthName]) {
        currentMonth = MONTHS[monthName];
        if (monthHeaderMatch[2]) {
          currentYear = parseInt(monthHeaderMatch[2], 10);
        }
        continue;
      }
    }

    // Check if line is a general month start
    const monthMatch = Object.keys(MONTHS).find(m => lowerLine.startsWith(m));
    if (monthMatch && !lowerLine.match(/\d+k?\s+[a-zA-Z]/)) {
      currentMonth = MONTHS[monthMatch];
      const yearMatch = trimmed.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        currentYear = parseInt(yearMatch[1], 10);
      }
      continue;
    }

    // Ignore Totals and structural notes
    if (trimmed.startsWith('Total:') || trimmed.startsWith('My share')) {
      continue;
    }

    let amount = -1;
    let rawDesc = '';

    if (lowerLine.includes('(0 me') || lowerLine.startsWith('0 ')) {
      const zeroMatch = trimmed.match(/^[\s\-*•#>]*0\s+(.+)$/i);
      amount = 0;
      rawDesc = zeroMatch ? zeroMatch[1] : trimmed;
    } else {
      // Bracket rule: extract first number-like string inside brackets
      const bracketMatch = trimmed.match(/\(\s*(\d+(?:\.\d+)?k?)/i);
      if (bracketMatch && !trimmed.startsWith('(')) {
        amount = parseVal(bracketMatch[1]);
        rawDesc = trimmed;
      } else {
        // Standard rule: [Optional bullets -*•#>] Amount Description
        const standardMatch = trimmed.match(/^[\s\-*•#+>]*(\d+(?:\.\d+)?k?)\s+(.+)$/i);
        if (standardMatch) {
          amount = parseVal(standardMatch[1]);
          rawDesc = standardMatch[2];
        }
      }
    }

    const hasLetters = /[a-zA-Z]/.test(rawDesc);
    const isValidAmount = amount >= 0;

    if (isValidAmount && hasLetters) {
      let finalCategory = 'General';
      let cleanDesc = rawDesc.trim();

      // 1. Check for explicit bracket tag: e.g. "Dinner [Food]" or "+5k [Savings]"
      const bracketTagMatch = cleanDesc.match(/\[([a-zA-Z\s:]+)\]/);
      if (bracketTagMatch) {
        finalCategory = bracketTagMatch[1].trim();
        cleanDesc = cleanDesc.replace(bracketTagMatch[0], '').trim();
      } else {
        // 2. Check for hash tag: e.g. "Dinner #Food"
        const hashTagMatch = cleanDesc.match(/#([a-zA-Z]+)/);
        if (hashTagMatch) {
          finalCategory = hashTagMatch[1].trim();
          cleanDesc = cleanDesc.replace(hashTagMatch[0], '').trim();
        } else {
          // 3. Smart Keyword Categorization
          const descLower = cleanDesc.toLowerCase();
          if (descLower.match(/\b(saving|savings|vault|reserve)\b/)) {
            finalCategory = 'Savings';
          } else if (descLower.match(/\b(food|eat|dining|coffee|lunch|dinner|breakfast|pizza|burger|cafe|restaurant|grocery|groceries|snack|tea|milk|bread|fruit|vegetable)\b/)) {
            finalCategory = 'Food';
          } else if (descLower.match(/\b(rent|home|house|apartment|flat)\b/)) {
            finalCategory = 'Rent';
          } else if (descLower.match(/\b(transport|car|fuel|petrol|diesel|cng|uber|careem|indrive|taxi|bus|metro|train|bike|flight|travel)\b/)) {
            finalCategory = 'Transport';
          } else if (descLower.match(/\b(shop|shopping|cloth|clothes|apparel|shirt|pant|shoes|bag|amazon|daraz|store|mall)\b/)) {
            finalCategory = 'Shopping';
          } else if (descLower.match(/\b(util|utilities|bill|electricity|wapda|water|gas|wifi|internet|ptcl|mobile bill|load)\b/)) {
            finalCategory = 'Utilities';
          } else if (descLower.match(/\b(entertain|entertainment|movie|cinema|film|game|gaming|steam|netflix|spotify|youtube|party|fun)\b/)) {
            finalCategory = 'Entertainment';
          } else if (descLower.match(/\b(medic|medical|medicine|health|doctor|hospital|clinic|pharmacy|drugs|pills|dentist|lab|test)\b/)) {
            finalCategory = 'Medical';
          } else if (descLower.match(/\b(salary|wage|freelance|client|profit)\b/)) {
            finalCategory = 'Salary';
          } else if (descLower.match(/\b(invest|investments|stock|crypto|bitcoin|gold|fund|shares)\b/)) {
            finalCategory = 'Investments';
          }
        }
      }

      // Check if this is a savings deposit / withdrawal
      if (
        finalCategory.toLowerCase().startsWith('saving') || 
        finalCategory.toLowerCase() === 'vault'
      ) {
        const isWithdraw = trimmed.startsWith('-') || cleanDesc.toLowerCase().includes('withdraw');
        savings.push({
          amount: Math.abs(amount),
          type: isWithdraw ? 'WITHDRAW' : 'DEPOSIT',
          date: `${currentYear}-${currentMonth}-15`,
          description: cleanDesc.replace(/^(deposit|withdraw|withdrawal):?\s*/i, '').trim() || (isWithdraw ? 'Withdrawal' : 'Deposit')
        });
        continue;
      }

      transactions.push({
        amount,
        type: 'EXPENSE',
        category: finalCategory,
        date: `${currentYear}-${currentMonth}-15`,
        description: cleanDesc || finalCategory
      });
    } else {
      failedLines.push(line);
    }
  }

  return { transactions, savings, failedLines };
}
