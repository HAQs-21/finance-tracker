import { memo, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { type JournalEntry, type Category } from "../domain";
import { Money } from "./primitives";
import { dateLabel, monthLabel } from "./dates";

/** Bound DOM work independently of ledger size; no history is truncated. */
function LedgerList({
  entries,
  hidden,
  savings = false,
  categories = [],
  onSelect,
}: {
  entries: JournalEntry[];
  hidden: boolean;
  savings?: boolean;
  categories?: Category[];
  onSelect?: (entry: JournalEntry) => void;
}) {
  const rows = useMemo(() => {
    if (!savings) return entries.map((entry) => ({ entry, month: "" }));
    const groups = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      const group = groups.get(entry.month);
      if (group) group.push(entry);
      else groups.set(entry.month, [entry]);
    }
    return [...groups]
      .sort(([a], [b]) => b.localeCompare(a))
      .flatMap(([month, group]) => [
        { entry: null as JournalEntry | null, month },
        ...group.map((entry) => ({ entry, month })),
      ]);
  }, [entries, savings]);
  const names = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  return (
    <Virtuoso
      className="virtual-ledger"
      style={{
        height: Math.min(384, rows.length * 64),
        overflowAnchor: "none",
      }}
      data={rows}
      fixedItemHeight={64}
      increaseViewportBy={128}
      computeItemKey={(_, row) => row.entry?.id || row.month}
      itemContent={(_, { entry, month }) =>
        entry ? (
          <button
            className="ledger-row"
            disabled={!onSelect}
            onClick={() => onSelect?.(entry)}
          >
            <span className="row-icon">
              {(savings ? entry.savingsDelta > 0 : entry.kind === "refund") ? (
                <ArrowDownLeft size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}
            </span>
            <span className="ledger-copy">
              <strong>
                {savings && entry.kind === "allocation"
                  ? `${names.get(entry.categoryId || "") || "Category"} · budget`
                  : savings && entry.kind === "release"
                    ? `${names.get(entry.categoryId || "") || "Category"} · returned`
                    : entry.note || entry.kind}
              </strong>
              <small>{dateLabel(entry.date)}</small>
            </span>
            <span className="ledger-signed">
              {savings && entry.savingsDelta > 0 ? "+" : ""}
              <Money
                value={savings ? entry.savingsDelta : entry.amount}
                hidden={hidden}
              />
            </span>
            {onSelect && <ChevronRight size={14} />}
          </button>
        ) : (
          <div className="ledger-month">{monthLabel(month)}</div>
        )
      }
    />
  );
}
export default memo(LedgerList);
