export interface ImportRow {
  id: string;
  type: "income" | "expense" | "transfer";
  /** Integer paisa, never floating-point rupees. */
  amount: number;
  date: string;
  category: string;
  note: string;
  sourceLine: number;
  inferredDate: boolean;
  transferDirection?: "deposit" | "withdrawal";
}

export interface ImportIssue {
  line: number;
  text: string;
  message: string;
  severity: "warning" | "error";
}

export interface ImportPreview {
  rows: ImportRow[];
  issues: ImportIssue[];
}

const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const categoryRules: [string, RegExp][] = [
  ["Tax", /\b(tax|fbr|duty)\b/i],
  [
    "Food",
    /\b(food|coffee|lunch|dinner|breakfast|pizza|burger|grocer\w*|snack|tea|milk|bread|cafe|restaurant)\b/i,
  ],
  ["Rent", /\b(rent|apartment)\b/i],
  [
    "Transport",
    /\b(fuel|petrol|diesel|uber|careem|indrive|taxi|bus|metro|train|travel)\b/i,
  ],
  ["Utilities", /\b(bill|electricity|water|gas|wifi|internet|ptcl)\b/i],
  ["Shopping", /\b(shopping|clothes|shoes|daraz|amazon)\b/i],
  ["Medical", /\b(medicine|doctor|hospital|clinic|pharmacy|dentist)\b/i],
  ["Entertainment", /\b(movie|cinema|game|netflix|spotify|party)\b/i],
];

export function parseImportAmount(value: string): number {
  const text = value.trim().replace(/^(?:PKR|Rs\.?)\s*/i, "");
  const match = text.match(
    /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*([kKmM])?$/,
  );
  if (!match)
    throw new Error(`Invalid amount “${value}”. Use up to two decimal places.`);
  const multiplier =
    match[4]?.toLowerCase() === "k"
      ? 1000
      : match[4]?.toLowerCase() === "m"
        ? 1_000_000
        : 1;
  const amount =
    (Number(match[2].replace(/,/g, "")) * 100 +
      Number((match[3] || "").padEnd(2, "0"))) *
    multiplier *
    (match[1] === "-" ? -1 : 1);
  if (!Number.isSafeInteger(amount)) throw new Error("Amount is too large.");
  return amount;
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** RFC4180-style CSV parser, including escaped quotes and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (!quoted && field)
        throw new Error("Unexpected quote in CSV field.");
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("An opening CSV quote has no closing quote.");
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function parseCsvPreview(text: string): ImportPreview {
  const output: ImportPreview = { rows: [], issues: [] };
  const records = parseCsv(text);
  const header =
    records.shift()?.map((name) => name.trim().toLowerCase()) ?? [];
  const field = (row: string[], ...names: string[]) =>
    row[header.findIndex((name) => names.includes(name))]?.trim() || "";
  if (
    !header.includes("date") ||
    !header.includes("amount") ||
    !header.includes("type")
  )
    throw new Error(
      "CSV needs Date, Type, and Amount columns. Category and Note are optional.",
    );
  records.forEach((record, index) => {
    try {
      const date = field(record, "date");
      if (!validDate(date))
        throw new Error(
          "Date must be a real calendar date in YYYY-MM-DD format.",
        );
      const rawType = field(record, "type").toLowerCase();
      const type = ["income", "earning", "earnings"].includes(rawType)
        ? "income"
        : ["expense", "spending"].includes(rawType)
          ? "expense"
          : ["transfer", "deposit", "withdrawal"].includes(rawType)
            ? "transfer"
            : null;
      if (!type) throw new Error(`Unknown type “${rawType}”.`);
      const amount = parseImportAmount(field(record, "amount"));
      if (amount <= 0) throw new Error("Amount must be greater than zero.");
      output.rows.push({
        id: `csv-${index + 2}`,
        type,
        amount,
        date,
        category:
          field(record, "category") ||
          (type === "income" ? "Earnings" : "General"),
        note: field(record, "note", "description"),
        sourceLine: index + 2,
        inferredDate: false,
        ...(type === "transfer"
          ? {
              transferDirection:
                rawType === "withdrawal"
                  ? ("withdrawal" as const)
                  : ("deposit" as const),
            }
          : {}),
      });
    } catch (error) {
      output.issues.push({
        line: index + 2,
        text: record.join(","),
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
    }
  });
  return output;
}

export function parseImportText(
  text: string,
  defaultDate = localDate(),
): ImportPreview {
  if (!validDate(defaultDate)) throw new Error("The default date is invalid.");
  const clean = text
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u200E\u200F\u00AD]/g, "");
  if (/^\s*"?date"?\s*,/i.test(clean)) return parseCsvPreview(clean);
  const output: ImportPreview = { rows: [], issues: [] };
  let year = defaultDate.slice(0, 4),
    month = defaultDate.slice(5, 7);
  const push = (row: Omit<ImportRow, "id">) => {
    if (row.amount <= 0)
      throw new Error(
        "Amount must be greater than zero; zero-value notes are preserved in diagnostics.",
      );
    output.rows.push({
      id: `text-${row.sourceLine}-${output.rows.length}`,
      ...row,
    });
  };
  clean.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const lineNumber = index + 1;
    try {
      const header = line.match(
        /^([a-z]+)(?:\s+(\d{4}))?(?:\s*\(([^)]+)\))?$/i,
      );
      if (header && months.includes(header[1].toLowerCase())) {
        month = String(months.indexOf(header[1].toLowerCase()) + 1).padStart(
          2,
          "0",
        );
        if (header[2]) year = header[2];
        if (header[3])
          header[3]
            .split("+")
            .forEach((part) =>
              push({
                type: "income",
                amount: parseImportAmount(part),
                date: `${year}-${month}-01`,
                category: "Earnings",
                note: `Income: ${header[1]}`,
                sourceLine: lineNumber,
                inferredDate: true,
              }),
            );
        return;
      }
      const income = line.match(/^(?:income\s*:\s*)?\(([^)]+)\)$/i);
      if (income) {
        income[1]
          .split("+")
          .forEach((part) =>
            push({
              type: "income",
              amount: parseImportAmount(part),
              date: `${year}-${month}-01`,
              category: "Earnings",
              note: "Income",
              sourceLine: lineNumber,
              inferredDate: true,
            }),
          );
        return;
      }
      if (/^(?:total\s*:|my share\b)/i.test(line)) {
        output.issues.push({
          line: lineNumber,
          text: raw,
          message:
            "Summary note retained here; no financial entry was inferred.",
          severity: "warning",
        });
        return;
      }
      let date = `${year}-${month}-15`,
        rest = line,
        inferredDate = true;
      const dated = rest.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
      if (dated) {
        date = dated[1];
        rest = dated[2];
        inferredDate = false;
        if (!validDate(date)) throw new Error("Invalid calendar date.");
      }
      const typed = rest.match(/^(income|earning|expense)\s*:?\s*(.+)$/i);
      const explicitIncome = typed && /^(income|earning)$/i.test(typed[1]);
      if (typed) rest = typed[2];
      const match = rest.match(
        /^(?:[•*>]\s*|-\s+)?([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?[kKmM]?)\s+(.+)$/u,
      );
      if (!match)
        throw new Error(
          "Expected an amount followed by a description, or a CSV row.",
        );
      let category = explicitIncome ? "Earnings" : "General";
      let note = match[2].trim();
      const tag = note.match(/\[([^\]\r\n]+)\]/u) || note.match(/#([^\s#]+)/u);
      if (tag) {
        category = tag[1].trim();
        note = note.replace(tag[0], "").trim();
      } else if (!explicitIncome)
        category =
          categoryRules.find(([, rule]) => rule.test(note))?.[0] || "General";
      const amount = parseImportAmount(match[1]);
      const transfer = /^(savings|vault)$/i.test(category);
      if (amount < 0 && !transfer)
        throw new Error(
          "Negative amounts require an explicit refund/correction workflow.",
        );
      push({
        type: transfer ? "transfer" : explicitIncome ? "income" : "expense",
        amount: Math.abs(amount),
        date,
        category,
        note: note || category,
        sourceLine: lineNumber,
        inferredDate,
        ...(transfer
          ? {
              transferDirection:
                amount < 0 || /withdraw/i.test(note)
                  ? ("withdrawal" as const)
                  : ("deposit" as const),
            }
          : {}),
      });
      if (inferredDate)
        output.issues.push({
          line: lineNumber,
          text: raw,
          message: `Date inferred as ${date}; review before importing.`,
          severity: "warning",
        });
    } catch (error) {
      output.issues.push({
        line: lineNumber,
        text: raw,
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
    }
  });
  return output;
}
