import "./plan.css";
import { monthLabel, shiftMonth } from "./dates";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { TactileCard } from "./TactileCard";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  Plus,
  Repeat2,
  Sparkles,
} from "lucide-react";
import {
  getActiveEntries,
  getMonthlyBudgets,
  localDate,
  projectFinance,
  templateForMonth,
  type FinanceState,
} from "../domain";
import { CategoryIcon, EmptyState, Money } from "./primitives";
import type { Dispatch, Notify } from "./AppShell";

export function Plan({
  state,
  month,
  setMonth,
  hidden,
  onIncome,
  onBudget,
  onCategory,
  onSavings,
  onExpense,
  dispatch,
  notify,
}: {
  state: FinanceState;
  month: string;
  setMonth: (m: string) => void;
  hidden: boolean;
  onIncome: () => void;
  onBudget: (id?: string) => void;
  onCategory: (id: string) => void;
  onSavings: () => void;
  onExpense: (id?: string) => void;
  dispatch: Dispatch;
  notify: Notify;
}) {
  const projection = useMemo(() => projectFinance(state), [state]);
  const monthly = useMemo(
    () => getMonthlyBudgets(state, month),
    [state, month],
  );
  const entries = useMemo(() => getActiveEntries(state), [state]);
  const income = entries
    .filter((e) => e.kind === "income" && e.month === month)
    .reduce((n, e) => n + e.amount, 0);
  const spent = entries
    .filter((e) => e.month === month)
    .reduce(
      (n, e) =>
        n +
        (e.kind === "expense" ? e.amount : e.kind === "refund" ? -e.amount : 0),
      0,
    );
  const future = month > state.activeMonth;
  const historical = month < state.activeMonth;
  const [pending, setPending] = useState(false);
  const active = monthly.filter((b) => b.status === "open" || historical);
  const drafts = future
    ? state.categories
        .filter(
          (c) =>
            !c.archived &&
            templateForMonth(state, c.id, month)?.enabled &&
            !monthly.some((b) => b.categoryId === c.id),
        )
        .map((c) => ({
          category: c,
          template: templateForMonth(state, c.id, month)!,
        }))
    : [];
  const activeCount = active.length + drafts.length;
  const fund = async (id: string) => {
    setPending(true);
    try {
      await dispatch({ type: "fund-budget", budgetId: id });
      notify("A little breathing room. Budget funded.");
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setPending(false);
    }
  };
  const date = new Date(`${month}-01T12:00:00`);
  const today = new Date(`${localDate()}T12:00:00`);
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const remainingDays = historical ? 0 : future ? days : days - today.getDate();
  return (
    <div className="plan-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span className="tiny-line" /> YOUR MONEY, WITH A LITTLE MORE
            INTENTION
          </p>
          <h1>
            A place for <em>every possibility.</em>
          </h1>
          <p className="page-subtitle">
            A clear plan. Room to live. A little left for tomorrow.
          </p>
        </div>
        <div className="month-picker">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="icon-button"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <label>
            <span className="sr-only">Choose budget month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
            <span>
              {monthLabel(month)}
              <ChevronRight size={13} />
            </span>
          </label>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="icon-button"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <section
        className="plan-overview"
        aria-label="Savings and monthly overview"
      >
        <motion.div
          className="savings-card"
          whileHover={{ y: -3 }}
          transition={{ duration: 0.3 }}
        >
          <div className="savings-orbit" aria-hidden="true">
            <svg viewBox="0 0 250 250">
              <circle cx="125" cy="125" r="104" />
              <ellipse
                cx="125"
                cy="125"
                rx="75"
                ry="104"
                transform="rotate(-38 125 125)"
              />
              <ellipse
                cx="125"
                cy="125"
                rx="42"
                ry="104"
                transform="rotate(-38 125 125)"
              />
            </svg>
            <span />
          </div>
          <div className="savings-label">
            <span className="small-dot" /> SAVINGS AVAILABLE
            <button
              className="icon-button"
              onClick={onSavings}
              aria-label="View savings history"
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <button className="savings-amount-button" onClick={onSavings}>
            <Money value={projection.savings} hidden={hidden} />
          </button>
          <p>Unallocated. Unhurried. Yours to decide.</p>
          <button className="savings-add" onClick={onIncome}>
            <Plus size={16} /> Add earnings{" "}
            <span>
              <ArrowDownLeft size={16} />
            </span>
          </button>
        </motion.div>
        <div className="month-story">
          <div className="story-top">
            <span className="eyebrow">
              {future
                ? "A LOOK AHEAD"
                : historical
                  ? "A CHAPTER KEPT"
                  : "THE MONTH, SO FAR"}
            </span>
            <span className="chapter">
              {String(date.getMonth() + 1).padStart(2, "0")}
              <span> / 12</span>
            </span>
          </div>
          <div className="story-main">
            <div>
              <p>{future ? "Your next chapter" : "Thoughtfully spent"}</p>
              <Money
                value={
                  future
                    ? [
                        ...active.map((b) => b.limit),
                        ...drafts.map((d) => d.template.amount),
                      ].reduce((a, b) => a + b, 0)
                    : spent
                }
                hidden={hidden}
              />
            </div>
            <div className="month-stamp">
              <span>
                {date
                  .toLocaleDateString("en", { month: "short" })
                  .toUpperCase()}
              </span>
              <strong>{date.getFullYear()}</strong>
            </div>
          </div>
          <div className="story-bottom">
            <span>
              <span className="status-dot" />
              {activeCount} {activeCount === 1 ? "category" : "categories"} with
              a plan
            </span>
            <span>
              {historical
                ? "History preserved"
                : `${remainingDays} days ${future ? "to make your own" : "to make the most of"}`}
            </span>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">SMALL PLANS. REAL POSSIBILITIES.</span>
          <h2>
            {future
              ? "Tomorrow’s envelopes"
              : historical
                ? "Your month, preserved"
                : "Your envelopes"}
            <span className="count-label">{activeCount}</span>
          </h2>
        </div>
        <button className="button subtle" onClick={() => onBudget()}>
          <Plus size={16} /> New budget
        </button>
      </div>
      {(future || historical) && (
        <div className="period-note">
          <Clock3 size={16} />
          {future
            ? "Recurring plans are ready for next month. Savings will be reserved when the month begins."
            : "This is a historical month. Its expenses and budget history are preserved."}
          <button onClick={() => setMonth(state.activeMonth)}>
            Back to this month <ArrowRight size={14} />
          </button>
        </div>
      )}
      {activeCount === 0 && (
        <div className="first-plan">
          <div>
            <span className="eyebrow">START WITH WHAT MATTERS</span>
            <h3>
              Good days start
              <br />
              with a little <em>room.</em>
            </h3>
            <p>
              Add your earnings, then give Food, Transport, or something you
              love a budget. Every rupee gets a place.
            </p>
            <button className="button primary" onClick={() => onBudget()}>
              Create your first budget <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="envelope-art" aria-hidden="true">
            <div className="art-slip one">SOMETHING GOOD</div>
            <div className="art-slip two">A LITTLE EVERYDAY</div>
            <div className="art-envelope">
              <span>M</span>
              <small>ROOM FOR TOMORROW</small>
            </div>
            <div className="art-spark">
              <Sparkles size={22} />
            </div>
          </div>
        </div>
      )}
      <motion.div className="budget-grid" layout>
        {active.map((b, index) => {
          const cat = state.categories.find((c) => c.id === b.categoryId)!;
          const balance = projection.budgets[b.id]?.available || 0;
          const used = projection.budgets[b.id]?.spent || 0;
          const ratio =
            b.limit > 0 ? Math.min(1, Math.max(0, used / b.limit)) : 0;
          const recurring = templateForMonth(
            state,
            cat.id,
            shiftMonth(month, 1),
          )?.enabled;
          return (
            <TactileCard
              layout
              key={b.id}
              className={`budget-card ${b.funding === "unfunded" ? "unfunded" : ""}`}
              style={{ "--category": cat.color } as React.CSSProperties}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.045, 0.24) }}
              whileHover={{ y: -4 }}
            >
              <button
                className="budget-card-main"
                onClick={() => onCategory(cat.id)}
                aria-label={`Open ${cat.name} budget`}
              >
                <div className="budget-top">
                  <motion.span
                    layoutId={`category-orb-${b.id}`}
                    className="category-orb"
                  >
                    <CategoryIcon name={cat.icon || cat.id} />
                  </motion.span>
                  <span className="budget-card-arrow">
                    <ArrowUpRight size={17} />
                  </span>
                </div>
                <div className="budget-name">
                  {cat.name}
                  {recurring && <Repeat2 size={12} aria-label="Recurring" />}
                </div>
                <Money
                  value={balance}
                  hidden={hidden}
                  className="budget-amount"
                />
                <span className="available-label">
                  {b.funding === "unfunded"
                    ? "waiting to be funded"
                    : b.status === "closed"
                      ? "closed · history kept"
                      : "left to enjoy"}
                </span>
                <div
                  className="segmented-meter"
                  aria-label={`${Math.round(ratio * 100)} percent spent`}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <span
                      key={i}
                      style={{ opacity: i / 24 < ratio ? 0.95 : 0.14 }}
                    />
                  ))}
                </div>
                <div className="budget-foot">
                  <span>
                    {hidden ? "•••" : `${Math.round(ratio * 100)}% spent`}
                  </span>
                  <span>
                    of <Money value={b.limit} hidden={hidden} />
                  </span>
                </div>
              </button>
              <div className="budget-card-actions">
                {b.funding === "unfunded" && !future ? (
                  <button disabled={pending} onClick={() => void fund(b.id)}>
                    Fund envelope <ArrowDownLeft size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => onExpense(cat.id)}
                    disabled={
                      future ||
                      historical ||
                      b.status === "closed" ||
                      balance <= 0
                    }
                  >
                    <Plus size={14} /> Add expense
                  </button>
                )}
                <button
                  onClick={() => onBudget(cat.id)}
                  aria-label={`Adjust ${cat.name} budget`}
                >
                  Adjust <ArrowRight size={13} />
                </button>
              </div>
            </TactileCard>
          );
        })}
        {drafts.map(({ category: cat, template }) => (
          <motion.article
            key={cat.id}
            className="budget-card draft-card"
            style={{ "--category": cat.color } as React.CSSProperties}
            whileHover={{ y: -4 }}
          >
            <button
              className="budget-card-main"
              onClick={() => onBudget(cat.id)}
            >
              <div className="budget-top">
                <span className="category-orb">
                  <CategoryIcon name={cat.icon} />
                </span>
                <Repeat2 size={16} />
              </div>
              <div className="budget-name">{cat.name}</div>
              <Money
                value={template.amount}
                hidden={hidden}
                className="budget-amount"
              />
              <span className="available-label">
                planned for {date.toLocaleDateString("en", { month: "long" })}
              </span>
              <div className="draft-rule" />
              <div className="budget-foot">
                <span>
                  <CircleDashed size={12} /> Not reserved yet
                </span>
                <span>
                  Edit plan <ArrowRight size={13} />
                </span>
              </div>
            </button>
          </motion.article>
        ))}
        {activeCount > 0 && (
          <motion.button
            layout
            className="add-budget-card"
            onClick={() => onBudget()}
            whileHover={{ y: -4 }}
          >
            <span>
              <Plus size={23} />
            </span>
            <strong>A place for something else.</strong>
            <small>Create a category budget</small>
          </motion.button>
        )}
      </motion.div>
      <div className="plan-bottom">
        <div className="recurring-note">
          <span>
            <Repeat2 size={18} />
          </span>
          <div>
            <strong>A fresh month. Already thought of.</strong>
            <p>
              Your recurring budgets follow you into next month. Past months
              stay exactly as they were.
            </p>
          </div>
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(state.activeMonth, 1))}
            aria-label="Preview next month"
          >
            <ArrowUpRight size={20} />
          </button>
        </div>
        <div className="earnings-note">
          <Check size={14} />
          <span>
            {income > 0 ? (
              <>
                This month’s earnings <Money value={income} hidden={hidden} />
              </>
            ) : (
              "Every earning starts in Savings."
            )}
          </span>
        </div>
      </div>
      {monthly.some((b) => b.status === "closed") && !historical && (
        <details className="archived-budgets">
          <summary>Closed envelopes · history preserved</summary>
          {monthly
            .filter((b) => b.status === "closed")
            .map((b) => (
              <button key={b.id} onClick={() => onCategory(b.categoryId)}>
                {state.categories.find((c) => c.id === b.categoryId)?.name}
                <span>
                  View history <ArrowUpRight size={14} />
                </span>
              </button>
            ))}
        </details>
      )}
      {historical && monthly.length === 0 && (
        <EmptyState
          title="A quieter chapter"
          description="There were no category budgets in this month. Historical transactions remain in Activity."
        />
      )}
    </div>
  );
}
