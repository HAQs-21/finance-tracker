import { memo } from "react";
import { Virtuoso } from "react-virtuoso";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { type JournalEntry } from "../domain";
import { Money } from "./primitives";
import { dateLabel } from "./dates";

/** Bound DOM work independently of ledger size; no history is truncated. */
function LedgerList({
  entries,
  hidden,
  savings = false,
  onSelect,
}: {
  entries: JournalEntry[];
  hidden: boolean;
  savings?: boolean;
  onSelect?: (entry: JournalEntry) => void;
}) {
  return (
    <Virtuoso
      className="virtual-ledger"
      style={{ height: Math.min(384, entries.length * 64) }}
      data={entries}
      fixedItemHeight={64}
      overscan={128}
      computeItemKey={(_, entry) => entry.id}
      itemContent={(_, entry) => (
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
            <strong>{entry.note || entry.kind}</strong>
            <small>{dateLabel(entry.date)}</small>
          </span>
          <Money
            value={savings ? entry.savingsDelta : entry.amount}
            hidden={hidden}
          />
          {onSelect && <ChevronRight size={14} />}
        </button>
      )}
    />
  );
}
export default memo(LedgerList);
