import "./plan.css";
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Edit3,
  Plus,
  Repeat2,
} from "lucide-react";
import {
  getActiveEntries,
  getMonthlyBudgets,
  projectFinance,
  templateForMonth,
  type Category,
  type FinanceState,
  type MonthlyBudget,
} from "../domain";
import { shiftMonth } from "./dates";
import { CategoryIcon, Money } from "./primitives";
import { MonthPicker } from "./MonthPicker";
import type { Dispatch, Notify } from "./AppShell";

const BudgetCard = memo(function BudgetCard({
  budget,
  category,
  available,
  spent,
  recurring,
  hidden,
  editable,
  pending,
  onCategory,
  onBudget,
  onExpense,
  onFund,
}: {
  budget: MonthlyBudget;
  category: Category;
  available: number;
  spent: number;
  recurring: boolean;
  hidden: boolean;
  editable: boolean;
  pending: boolean;
  onCategory: (id: string) => void;
  onBudget: (id?: string) => void;
  onExpense: (id?: string) => void;
  onFund: (id: string) => void;
}) {
  const ratio = budget.limit
    ? Math.min(1, Math.max(0, spent / budget.limit))
    : 0;
  return (
    <article
      className={`budget-card ${budget.funding === "unfunded" ? "unfunded" : ""}`}
      style={{ "--category": category.color } as CSSProperties}
    >
      <div className="budget-card-heading">
        <span className="category-orb">
          <CategoryIcon name={category.icon} size={20} />
        </span>
        <strong>{category.name}</strong>
        {recurring && <Repeat2 size={13} aria-label="Recurring" />}
        {editable && (
          <button
            className="icon-button"
            onClick={() => onBudget(category.id)}
            aria-label={`Adjust ${category.name} budget`}
          >
            <Edit3 size={15} />
          </button>
        )}
      </div>
      <button
        className="budget-card-main"
        onClick={() => onCategory(category.id)}
        aria-label={`Open ${category.name} budget`}
      >
        <Money value={available} hidden={hidden} className="budget-amount" />
        <span className="available-label">
          {budget.funding === "unfunded"
            ? "Not funded"
            : editable
              ? "Available"
              : "Unused"}
        </span>
        <div
          className="budget-progress"
          role="progressbar"
          aria-label={`${category.name} budget spent`}
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ transform: `scaleX(${ratio})` }} />
        </div>
        <div className="budget-foot">
          <Money value={spent} hidden={hidden} />
          <span>
            / <Money value={budget.limit} hidden={hidden} />
          </span>
        </div>
      </button>
      {editable && (
        <div className="budget-card-actions">
          {budget.funding === "unfunded" ? (
            <button disabled={pending} onClick={() => onFund(budget.id)}>
              <ArrowDownLeft size={15} /> Fund budget
            </button>
          ) : (
            <button onClick={() => onExpense(category.id)}>
              <Plus size={15} /> Add expense
            </button>
          )}
        </div>
      )}
    </article>
  );
});

export const Plan = memo(function Plan({
  state,
  month,
  setMonth,
  hidden,
  onIncome,
  onBudget,
  onCategory,
  onExpense,
  onExpenses,
  dispatch,
  notify,
}: {
  state: FinanceState;
  month: string;
  setMonth: (month: string) => void;
  hidden: boolean;
  onIncome: () => void;
  onBudget: (id?: string) => void;
  onCategory: (id: string) => void;
  onExpense: (id?: string) => void;
  onExpenses: () => void;
  dispatch: Dispatch;
  notify: Notify;
}) {
  const projection = useMemo(() => projectFinance(state), [state]);
  const monthly = useMemo(
    () => getMonthlyBudgets(state, month),
    [state, month],
  );
  const categories = useMemo(
    () => new Map(state.categories.map((category) => [category.id, category])),
    [state.categories],
  );
  const spent = useMemo(
    () =>
      getActiveEntries(state).reduce(
        (total, entry) =>
          total +
          (entry.month === month
            ? entry.kind === "expense"
              ? entry.amount
              : entry.kind === "refund"
                ? -entry.amount
                : 0
            : 0),
        0,
      ),
    [state, month],
  );
  const future = month > state.activeMonth;
  const historical = month < state.activeMonth;
  const [pending, setPending] = useState<string | null>(null);
  const active = monthly.filter(
    (budget) => budget.status === "open" || historical,
  );
  const drafts = future
    ? state.categories.flatMap((category) => {
        const template = templateForMonth(state, category.id, month);
        return !category.archived &&
          template?.enabled &&
          !monthly.some((budget) => budget.categoryId === category.id)
          ? [{ category, template }]
          : [];
      })
    : [];
  const fund = useCallback(
    async (id: string) => {
      setPending(id);
      try {
        await dispatch({ type: "fund-budget", budgetId: id });
        notify("Budget funded");
      } catch (error) {
        notify((error as Error).message, true);
      } finally {
        setPending(null);
      }
    },
    [dispatch, notify],
  );
  return (
    <div className="plan-page">
      <div className="page-heading">
        <h1>Budgets</h1>
        <MonthPicker
          value={month}
          onChange={setMonth}
          label="Choose budget month"
        />
      </div>
      <section className="month-summary" aria-label="Monthly overview">
        <button onClick={onExpenses} className="summary-spent">
          <span>
            Spent <ArrowUpRight size={14} />
          </span>
          <Money value={spent} hidden={hidden} />
        </button>
      </section>
      <div className="plan-actions">
        <button className="button secondary" onClick={onIncome}>
          <Plus size={16} /> Add earnings
        </button>
        <button className="button primary" onClick={() => onBudget()}>
          <Plus size={16} /> New budget
        </button>
      </div>
      {(future || historical) && (
        <div className="period-note">
          <span>
            {future ? "Templates · funding starts next month" : "Past month"}
          </span>
          <button onClick={() => setMonth(state.activeMonth)}>
            This month <ChevronRight size={14} />
          </button>
        </div>
      )}
      {!active.length && !drafts.length && (
        <div className="empty-state compact-empty">
          <h3>No budgets</h3>
          <p>Add earnings, then create a budget.</p>
        </div>
      )}
      <div className="budget-grid">
        {active.map((budget) => {
          const category = categories.get(budget.categoryId)!;
          const used = projection.budgets[budget.id]?.spent || 0;
          return (
            <BudgetCard
              key={budget.id}
              budget={budget}
              category={category}
              available={
                historical
                  ? Math.max(0, budget.limit - used)
                  : projection.budgets[budget.id]?.available || 0
              }
              spent={used}
              recurring={
                !!templateForMonth(state, category.id, shiftMonth(month, 1))
                  ?.enabled
              }
              hidden={hidden}
              editable={!historical && !future}
              pending={pending === budget.id}
              onCategory={onCategory}
              onBudget={onBudget}
              onExpense={onExpense}
              onFund={fund}
            />
          );
        })}
        {drafts.map(({ category, template }) => (
          <article
            key={category.id}
            className="budget-card draft-card"
            style={{ "--category": category.color } as CSSProperties}
          >
            <button
              className="budget-card-main"
              onClick={() => onBudget(category.id)}
            >
              <div className="budget-card-heading">
                <span className="category-orb">
                  <CategoryIcon name={category.icon} size={20} />
                </span>
                <strong>{category.name}</strong>
                <Repeat2 size={14} />
              </div>
              <Money
                value={template.amount}
                hidden={hidden}
                className="budget-amount"
              />
              <span className="available-label">Template · not funded</span>
            </button>
          </article>
        ))}
      </div>
      {monthly.some((budget) => budget.status === "closed") && !historical && (
        <details className="archived-budgets">
          <summary>Closed budgets</summary>
          {monthly
            .filter((budget) => budget.status === "closed")
            .map((budget) => (
              <button
                key={budget.id}
                onClick={() => onCategory(budget.categoryId)}
              >
                <span>{categories.get(budget.categoryId)?.name}</span>
                <ChevronRight size={16} />
              </button>
            ))}
        </details>
      )}
    </div>
  );
});
