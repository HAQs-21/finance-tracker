import "./reports.css";
import { dateLabel } from "./dates";
import { memo, useDeferredValue, useMemo, useState } from "react";
import { MonthPicker } from "./MonthPicker";
import { useViewState } from "./useViewState";
import { Virtuoso } from "react-virtuoso";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  getActiveEntries,
  type FinanceState,
  type JournalEntry,
} from "../domain";
import { CategoryIcon, EmptyState, Money } from "./primitives";

type FeedRow = { date?: string; count?: number; entry?: JournalEntry };
function Activity({
  state,
  month,
  setMonth,
  hidden,
  onSelect,
  onAdd,
}: {
  state: FinanceState;
  month: string;
  setMonth: (month: string) => void;
  hidden: boolean;
  onSelect: (entry: JournalEntry) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useViewState(`${state.id}:activity:search`, "");
  const [type, setType] = useViewState(`${state.id}:activity:type`, "expense");
  const [sort, setSort] = useViewState(`${state.id}:activity:sort`, "date");
  const [category, setCategory] = useViewState(
    `${state.id}:activity:category`,
    "all",
  );
  const [from, setFrom] = useViewState(`${state.id}:activity:from`, "");
  const [to, setTo] = useViewState(`${state.id}:activity:to`, "");
  const [filters, setFilters] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const categoryMap = useMemo(
    () => new Map(state.categories.map((c) => [c.id, c])),
    [state.categories],
  );
  const entries = useMemo(() => getActiveEntries(state), [state]);
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase();
    const list = entries.filter(
      (e) =>
        (type === "all" || e.kind === type) &&
        (category === "all" || e.categoryId === category) &&
        (month === "all"
          ? (!from || e.date >= from) && (!to || e.date <= to)
          : e.month === month) &&
        (!query ||
          `${e.note} ${categoryMap.get(e.categoryId || "")?.name || "Earnings"}`
            .toLocaleLowerCase()
            .includes(query)),
    );
    const frequencies = new Map<string, number>();
    if (sort === "frequent")
      entries.forEach((e) => {
        const key = `${e.kind}:${(e.note || e.categoryId || "").trim().toLowerCase()}`;
        frequencies.set(key, (frequencies.get(key) || 0) + 1);
      });
    return list.sort((a, b) =>
      sort === "high"
        ? b.amount - a.amount
        : sort === "low"
          ? a.amount - b.amount
          : sort === "frequent"
            ? (frequencies.get(
                `${b.kind}:${(b.note || b.categoryId || "").trim().toLowerCase()}`,
              ) || 0) -
              (frequencies.get(
                `${a.kind}:${(a.note || a.categoryId || "").trim().toLowerCase()}`,
              ) || 0)
            : b.date.localeCompare(a.date),
    );
  }, [
    entries,
    deferredSearch,
    type,
    category,
    from,
    to,
    sort,
    categoryMap,
    month,
  ]);
  const rows = useMemo<FeedRow[]>(() => {
    const list: FeedRow[] = [];
    if (sort !== "date") return filtered.map((entry) => ({ entry }));
    const groups = new Map<string, JournalEntry[]>();
    filtered.forEach((e) => {
      const group = groups.get(e.date);
      if (group) group.push(e);
      else groups.set(e.date, [e]);
    });
    groups.forEach((items, date) => {
      list.push({ date, count: items.length });
      if (!collapsed.has(date)) list.push(...items.map((entry) => ({ entry })));
    });
    return list;
  }, [filtered, collapsed, sort]);
  const reset = () => {
    setSearch("");
    setType("expense");
    setMonth(state.activeMonth);
    setCategory("all");
    setFrom("");
    setTo("");
  };
  return (
    <div className="activity-page">
      <div className="page-heading">
        <h1>Expenses</h1>
        <MonthPicker
          value={month}
          onChange={setMonth}
          allowAll
          label="Choose expense month"
        />
      </div>
      <div className="activity-toolbar">
        <div className="search-field">
          <Search size={19} />
          <input
            data-search
            aria-label="Search transactions"
            placeholder="Search records"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={16} />
            </button>
          ) : (
            <kbd>⌘ K</kbd>
          )}
        </div>
        <button
          className={`button secondary filter-button ${filters ? "selected" : ""}`}
          onClick={() => setFilters(!filters)}
          aria-expanded={filters}
        >
          <SlidersHorizontal size={16} />
          <span>Filters</span>
        </button>
      </div>
      <div className="activity-controls">
        <div className="pill-tabs" aria-label="Transaction type">
          {[
            ["all", "All"],
            ["expense", "Expenses"],
            ["income", "Earnings"],
            ["refund", "Refunds"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={type === id ? "active" : ""}
              onClick={() => setType(id)}
              aria-pressed={type === id}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="sort-select">
          <span>Sort by</span>
          <select
            aria-label="Sort transactions"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date">Most recent</option>
            <option value="high">Highest amount</option>
            <option value="low">Lowest amount</option>
            <option value="frequent">Most frequent</option>
          </select>
        </label>
      </div>
      {filters && (
        <div className="expanded-filters">
          <label>
            Category
            <select
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setMonth("all");
              }}
            />
          </label>
          <label>
            To
            <input
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setMonth("all");
              }}
            />
          </label>
          <button className="quiet-button" onClick={reset}>
            Clear filters
          </button>
        </div>
      )}
      <div className="feed-label">
        <span>
          {type === "all"
            ? "Records"
            : type === "income"
              ? "Earnings"
              : type === "refund"
                ? "Refunds"
                : "Expenses"}
        </span>
        <span>
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {rows.length ? (
        <Virtuoso
          useWindowScroll
          data={rows}
          overscan={300}
          computeItemKey={(index, row) => row.entry?.id || row.date || index}
          itemContent={(_, row) =>
            row.entry ? (
              (() => {
                const e = row.entry;
                const cat = categoryMap.get(e.categoryId || "");
                const income = e.kind === "income";
                return (
                  <button className="activity-row" onClick={() => onSelect(e)}>
                    <span
                      className={`activity-icon ${income ? "income" : ""}`}
                      style={
                        {
                          "--category": cat?.color || "#9fb9a0",
                        } as React.CSSProperties
                      }
                    >
                      {income ? (
                        <ArrowDownLeft size={21} />
                      ) : e.kind === "refund" ? (
                        <ArrowDownLeft size={21} />
                      ) : (
                        <CategoryIcon name={cat?.icon} />
                      )}
                    </span>
                    <span className="activity-description">
                      <strong>
                        {e.note ||
                          (income ? "Earnings" : cat?.name || "Expense")}
                      </strong>
                      <small>
                        {income
                          ? "Into Savings"
                          : cat?.name || "Legacy history"}
                        {e.legacyId && (
                          <span
                            className="legacy-dot"
                            title="Preserved original record"
                          />
                        )}
                      </small>
                    </span>
                    <span
                      className={`activity-amount ${income || e.kind === "refund" ? "positive" : ""}`}
                    >
                      <span>
                        {income || e.kind === "refund" ? "+" : "−"}
                        <Money value={e.amount} hidden={hidden} />
                      </span>
                      <small>{dateLabel(e.date)}</small>
                    </span>
                    <ArrowUpRight size={16} className="row-arrow" />
                  </button>
                );
              })()
            ) : (
              <button
                className="date-group"
                onClick={() =>
                  setCollapsed((old) => {
                    const next = new Set(old);
                    if (next.has(row.date!)) next.delete(row.date!);
                    else next.add(row.date!);
                    return next;
                  })
                }
                aria-expanded={!collapsed.has(row.date!)}
              >
                {collapsed.has(row.date!) ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                <span>{dateLabel(row.date!)}</span>
                <span>{row.count}</span>
              </button>
            )
          }
        />
      ) : (
        <EmptyState
          title={entries.length ? "No matching records" : "No expenses yet"}
          description={
            entries.length
              ? "Choose another month or reset filters."
              : "Add an expense to a funded budget."
          }
        >
          <button
            className="button secondary"
            onClick={entries.length ? reset : onAdd}
          >
            {entries.length ? "Reset filters" : "Add expense"}{" "}
            <ArrowUpRight size={16} />
          </button>
        </EmptyState>
      )}
    </div>
  );
}
export default memo(Activity);
