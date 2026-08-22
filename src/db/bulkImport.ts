import type { Transaction } from '../types';

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
  failedLines: string[];
}

export async function parseTextToPreview(rawText: string): Promise<ParseResult> {
  const sanitized = sanitizeText(rawText);
  const lines = sanitized.split(/\r?\n/);
  let currentYear = new Date().getFullYear();
  let currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  
  const transactions: Transaction[] = [];
  const failedLines: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lowerLine = trimmed.toLowerCase();

    // Pattern: Month [Year] (IncomeExpression) e.g. "January 2025 (80k+10k)" or "January (80k+10k)"
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

    // Pattern: Simple Month Header, e.g. "January 2025" or "February"
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
    let description = '';
    let isZeroRule = false;

    if (lowerLine.includes('(0 me')) {
      amount = 0;
      description = trimmed;
      isZeroRule = true;
    } else {
      // Bracket rule: extract first number-like string inside brackets
      const bracketMatch = trimmed.match(/\(\s*(\d+(?:\.\d+)?k?)/i);
      if (bracketMatch) {
        amount = parseVal(bracketMatch[1]);
        description = trimmed;
      } else {
        // Standard rule: [Optional bullets -*•#>] Amount Description
        const standardMatch = trimmed.match(/^[\s\-*•#>]*(\d+(?:\.\d+)?k?)\s+(.+)$/i);
        if (standardMatch) {
          amount = parseVal(standardMatch[1]);
          description = standardMatch[2];
        }
      }
    }

    const hasLetters = /[a-zA-Z]/.test(description);
    const isValidAmount = isZeroRule || (amount > 0);

    if (isValidAmount && hasLetters) {
      transactions.push({
        amount,
        type: 'EXPENSE',
        category: 'Imported',
        date: `${currentYear}-${currentMonth}-15`,
        description: description.trim()
      });
    } else {
      failedLines.push(line);
    }
  }

  return { transactions, failedLines };
}
