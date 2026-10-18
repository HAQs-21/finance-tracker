import "./reports.css";
import { memo, useMemo, type CSSProperties } from "react";
import { getActiveEntries, formatMoney, type FinanceState } from "../domain";
import { monthLabel } from "./dates";
import { MonthPicker } from "./MonthPicker";
import { CategoryIcon, EmptyState, Money } from "./primitives";

function Insights({
  state,
  month,
  setMonth,
  hidden,
}: {
  state: FinanceState;
  month: string;
  setMonth: (month: string) => void;
  hidden: boolean;
}) {
  const report = useMemo(() => {
    let income = 0,
      spent = 0,
      count = 0;
    const categories = new Map<string, number>();
    const points = new Map<string, number>();
    if (month !== "all") {
      const days = new Date(
        Number(month.slice(0, 4)),
        Number(month.slice(5, 7)),
        0,
      ).getDate();
      for (let day = 1; day <= days; day++)
        points.set(`${month}-${String(day).padStart(2, "0")}`, 0);
    }
    for (const entry of getActiveEntries(state)) {
      if (month !== "all" && entry.month !== month) continue;
      if (entry.kind === "income") income += entry.amount;
      if (entry.kind !== "expense" && entry.kind !== "refund") continue;
      const amount = entry.kind === "expense" ? entry.amount : -entry.amount;
      if (entry.kind === "expense") count++;
      spent += amount;
      if (entry.categoryId)
        categories.set(
          entry.categoryId,
          (categories.get(entry.categoryId) || 0) + amount,
        );
      const key = month === "all" ? entry.month : entry.date;
      points.set(key, (points.get(key) || 0) + amount);
    }
    const breakdown = state.categories
      .map((category) => ({
        ...category,
        amount: categories.get(category.id) || 0,
      }))
      .filter((category) => category.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
    const tax = breakdown
      .filter((category) =>
        ["tax", "fbr", "duty"].includes(category.name.trim().toLowerCase()),
      )
      .reduce((total, category) => total + category.amount, 0);
    const series = [...points]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
    const positiveMax = Math.max(1, ...series.map((point) => point.amount));
    const negativeMax = Math.max(0, ...series.map((point) => -point.amount));
    const categoryMax = Math.max(
      1,
      ...breakdown.map((category) => Math.abs(category.amount)),
    );
    return {
      income,
      spent,
      count,
      breakdown,
      tax,
      series,
      positiveMax,
      negativeMax,
      categoryMax,
      average: count ? Math.round(spent / count) : 0,
    };
  }, [state, month]);
  const signed = report.negativeMax > 0;
  return (
    <div className="insights-page">
      <div className="page-heading">
        <h1>Reports</h1>
        <MonthPicker
          value={month}
          onChange={setMonth}
          allowAll
          label="Choose report month"
        />
      </div>
      <div className="insight-summary">
        <div>
          <p>Earnings</p>
          <Money value={report.income} hidden={hidden} />
        </div>
        <div>
          <p>Net spending</p>
          <Money value={report.spent} hidden={hidden} />
        </div>
        <div>
          <p>Average expense</p>
          <Money value={report.average} hidden={hidden} />
        </div>
      </div>
      <section className="chart-card">
        <div className="section-heading">
          <h2>Spending</h2>
          <span className="muted">
            {report.count} expenses · refunds deducted
          </span>
        </div>
        {report.series.some((point) => point.amount !== 0) ? (
          <>
            <div
              className={`bar-chart ${signed ? "signed-chart" : ""} ${hidden ? "chart-hidden" : ""}`}
              role="img"
              aria-label={
                hidden
                  ? "Spending chart hidden"
                  : `Spending for ${month === "all" ? "all time" : monthLabel(month)}; refunds below zero`
              }
            >
              <div className="chart-grid">
                <span />
                <span />
                <span />
              </div>
              {report.series.map((point, index) => (
                <div
                  className={`chart-column ${point.amount < 0 ? "negative" : ""}`}
                  key={point.date}
                  title={
                    hidden
                      ? "Hidden"
                      : `${point.date}: ${formatMoney(point.amount)}`
                  }
                >
                  <div
                    style={{
                      height: `${(Math.abs(point.amount) / Math.max(report.negativeMax, report.positiveMax)) * (signed ? 50 : 100)}%`,
                      animationDelay: `${Math.min(index * 8, 150)}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="chart-axis">
              <span>
                {report.series[0]?.date.slice(month === "all" ? 0 : -2)}
              </span>
              <span>{month === "all" ? "Monthly" : monthLabel(month)}</span>
              <span>
                {report.series.at(-1)?.date.slice(month === "all" ? 0 : -2)}
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            title="No spending"
            description="Choose another month to see its report."
          />
        )}
      </section>
      <section className="category-breakdown">
        <div className="section-heading">
          <h2>Categories</h2>
          <span className="muted">{report.breakdown.length}</span>
        </div>
        {report.breakdown.length ? (
          report.breakdown.map((category) => (
            <div
              className="breakdown-row"
              key={category.id}
              style={{ "--category": category.color } as CSSProperties}
            >
              <span className="category-orb">
                <CategoryIcon name={category.icon} />
              </span>
              <div className="breakdown-main">
                <strong>{category.name}</strong>
                <div className="breakdown-meter">
                  <span
                    style={{
                      transform: `scaleX(${Math.abs(category.amount) / report.categoryMax})`,
                    }}
                  />
                </div>
              </div>
              <Money value={category.amount} hidden={hidden} />
            </div>
          ))
        ) : (
          <EmptyState
            title="No category spending"
            description="Expenses and refunds appear here."
          />
        )}
        {report.tax !== 0 && (
          <div className="tax-total">
            <span>
              Tax payments <small>Included above</small>
            </span>
            <Money value={report.tax} hidden={hidden} />
          </div>
        )}
      </section>
    </div>
  );
}
export default memo(Insights);
