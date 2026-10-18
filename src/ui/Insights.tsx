import "./reports.css";
import { monthLabel } from "./dates";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Landmark,
  TrendingDown,
} from "lucide-react";
import {
  availableMonths,
  getActiveEntries,
  localDate,
  type FinanceState,
} from "../domain";
import { CategoryIcon, EmptyState, Money } from "./primitives";

export default function Insights({
  state,
  hidden,
}: {
  state: FinanceState;
  hidden: boolean;
}) {
  const [period, setPeriod] = useState(state.activeMonth);
  const entries = useMemo(
    () =>
      getActiveEntries(state).filter(
        (e) => period === "all" || e.month === period,
      ),
    [state, period],
  );
  const income = entries
    .filter((e) => e.kind === "income")
    .reduce((n, e) => n + e.amount, 0);
  const spent = entries.reduce(
    (n, e) =>
      n +
      (e.kind === "expense" ? e.amount : e.kind === "refund" ? -e.amount : 0),
    0,
  );
  const categories = useMemo(
    () =>
      state.categories
        .map((c) => ({
          ...c,
          amount: entries
            .filter((e) => e.categoryId === c.id)
            .reduce(
              (n, e) =>
                n +
                (e.kind === "expense"
                  ? e.amount
                  : e.kind === "refund"
                    ? -e.amount
                    : 0),
              0,
            ),
        }))
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [state.categories, entries],
  );
  const tax = categories
    .filter((c) => ["tax", "fbr", "duty"].includes(c.name.trim().toLowerCase()))
    .reduce((n, c) => n + c.amount, 0);
  const series = useMemo(() => {
    const points = new Map<string, number>();
    const month = period === "all" ? localDate().slice(0, 7) : period;
    const days = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0,
    ).getDate();
    if (period === "all") {
      const months = [...new Set(entries.map((e) => e.month))].sort();
      months.forEach((m) => points.set(m, 0));
    } else
      for (let day = 1; day <= days; day++)
        points.set(`${month}-${String(day).padStart(2, "0")}`, 0);
    entries.forEach((e) => {
      if (e.kind === "expense" || e.kind === "refund") {
        const key = period === "all" ? e.month : e.date;
        points.set(
          key,
          (points.get(key) || 0) +
            (e.kind === "expense" ? e.amount : -e.amount),
        );
      }
    });
    return [...points.entries()].map(([date, amount]) => ({ date, amount }));
  }, [entries, period]);
  const max = Math.max(1, ...series.map((p) => p.amount));
  const totalCount = entries.filter((e) => e.kind === "expense").length;
  const average = totalCount ? Math.round(spent / totalCount) : 0;
  return (
    <div className="insights-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span className="tiny-line" /> A LITTLE PERSPECTIVE GOES A LONG WAY
          </p>
          <h1>
            See the <em>bigger picture.</em>
          </h1>
          <p className="page-subtitle">
            Find the patterns. Keep what matters. Make room for what’s next.
          </p>
        </div>
        <select
          className="period-select"
          aria-label="Report period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All time</option>
          {availableMonths(state)
            .filter((m) => m <= state.activeMonth)
            .map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
        </select>
      </div>
      <div className="insight-summary">
        <div>
          <span className="summary-icon">
            <ArrowDownLeft size={19} />
          </span>
          <p>Earnings</p>
          <Money value={income} hidden={hidden} />
          <small>Money that came your way</small>
        </div>
        <div>
          <span className="summary-icon copper">
            <ArrowUpRight size={19} />
          </span>
          <p>Net spending</p>
          <Money value={spent} hidden={hidden} />
          <small>Expenses, with refunds returned</small>
        </div>
        <div>
          <span className="summary-icon blue">
            <TrendingDown size={19} />
          </span>
          <p>Average expense</p>
          <Money value={average} hidden={hidden} />
          <small>Across {totalCount} everyday moments</small>
        </div>
      </div>
      <div className="insights-columns">
        <section className="chart-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE RHYTHM OF THINGS</p>
              <h2>Spending, over time.</h2>
            </div>
            <span className="chart-key">
              <span /> Net expenses
            </span>
          </div>
          {series.some((p) => p.amount !== 0) ? (
            <>
              <div
                className={`bar-chart ${hidden ? "chart-hidden" : ""}`}
                role="img"
                aria-label={
                  hidden
                    ? "Spending chart hidden"
                    : `Spending chart for ${period === "all" ? "all time" : monthLabel(period)}`
                }
              >
                <div className="chart-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                {series.map((p, i) => (
                  <div
                    className="chart-column"
                    key={p.date}
                    title={
                      hidden
                        ? "Hidden"
                        : `${p.date}: Rs ${(p.amount / 100).toLocaleString()}`
                    }
                  >
                    <div
                      style={{
                        height: `${Math.max(p.amount > 0 ? 2 : 0, (p.amount / max) * 100)}%`,
                        animationDelay: `${Math.min(i * 15, 300)}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="chart-axis">
                <span>{period === "all" ? series[0]?.date : "01"}</span>
                <span>
                  {period === "all"
                    ? "Across your history"
                    : monthLabel(period)}
                </span>
                <span>
                  {series.at(-1)?.date.slice(period === "all" ? 0 : -2)}
                </span>
              </div>
            </>
          ) : (
            <EmptyState
              title="A clear horizon."
              description="Your spending rhythm will appear as you record expenses."
            />
          )}
        </section>
        <section className="tax-note">
          <span className="tax-symbol">
            <Landmark size={27} />
          </span>
          <p className="eyebrow">ONE LESS THING TO WONDER</p>
          <h3>
            Your tax,
            <br />
            <em>in one place.</em>
          </h3>
          <Money value={tax} hidden={hidden} />
          <p>
            Recorded tax payments for{" "}
            {period === "all" ? "your full history" : monthLabel(period)}.
            Already included in spending.
          </p>
        </section>
      </div>
      <section className="category-breakdown">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WHERE THE EVERYDAY GOES</p>
            <h2>A little of everything.</h2>
          </div>
          <span className="muted">{categories.length} categories</span>
        </div>
        {categories.length ? (
          categories.map((c, i) => (
            <div
              className="breakdown-row"
              key={c.id}
              style={{ "--category": c.color } as React.CSSProperties}
            >
              <span className="breakdown-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="category-orb">
                <CategoryIcon name={c.icon} />
              </span>
              <div className="breakdown-main">
                <strong>{c.name}</strong>
                <div className="breakdown-meter">
                  <span
                    style={{
                      width: `${Math.max(1, spent > 0 ? (c.amount / spent) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
              <span className="breakdown-share">
                {hidden
                  ? "••"
                  : `${spent > 0 ? Math.round((c.amount / spent) * 100) : 0}%`}
              </span>
              <Money value={c.amount} hidden={hidden} />
              <ArrowRight size={15} />
            </div>
          ))
        ) : (
          <EmptyState
            title="Everything in its own time."
            description="Your category breakdown will appear here after your first expense."
          />
        )}
      </section>
    </div>
  );
}
