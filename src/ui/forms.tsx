import { monthLabel, dateLabel } from "./dates";
import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Edit3,
  Grid2X2,
  History,
  Plus,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  budgetBalance,
  budgetSpent,
  formatMoney,
  getActiveEntries,
  isReversed,
  localDate,
  savingsBalance,
  savingsTransactions,
  totalBalance,
  templateForMonth,
  toMinor,
  type FinanceState,
  type JournalEntry,
} from "../domain";
import {
  EmptyState,
  Field,
  InlineError,
  Money,
  Sheet,
  Submit,
} from "./primitives";
import { categoryColors } from "./colors";
import type { Dispatch, Notify } from "./AppShell";
import "./forms.css";
const LedgerList = lazy(() => import("./LedgerList"));

export function EntrySheet({
  state,
  mode,
  categoryId,
  dispatch,
  onClose,
  notify,
  editing,
}: {
  state: FinanceState;
  mode: "income" | "expense";
  categoryId?: string;
  dispatch: Dispatch;
  onClose: () => void;
  notify: Notify;
  editing?: JournalEntry;
}) {
  const [amount, setAmount] = useState(
    editing ? String(editing.amount / 100) : "",
  );
  const [category, setCategory] = useState(
    categoryId || editing?.categoryId || "",
  );
  const [date, setDate] = useState(
    editing && editing.month === state.activeMonth ? editing.date : localDate(),
  );
  const [note, setNote] = useState(editing?.note || "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const budget = state.budgets.find(
    (b) =>
      b.categoryId === category &&
      b.month === date.slice(0, 7) &&
      b.status === "open",
  );
  const available = budget
    ? budgetBalance(state, budget.id) +
      (editing?.budgetId === budget.id ? editing.amount : 0)
    : 0;
  let entered = 0;
  try {
    entered = amount ? toMinor(amount) : 0;
  } catch {
    /* Validation on submit. */
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const value = toMinor(amount);
      if (mode === "income")
        await dispatch(
          editing
            ? {
                type: "update-income",
                entryId: editing.id,
                amount: value,
                date,
                note,
              }
            : { type: "add-income", amount: value, date, note },
        );
      else
        await dispatch(
          editing
            ? {
                type: "update-expense",
                entryId: editing.id,
                categoryId: category,
                amount: value,
                date,
                note,
              }
            : {
                type: "add-expense",
                categoryId: category,
                amount: value,
                date,
                note,
              },
        );
      notify(
        editing
          ? "Correction saved"
          : mode === "income"
            ? "Earnings added to Savings"
            : "Expense recorded",
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet
      title={
        editing
          ? "Edit transaction"
          : mode === "income"
            ? "Add earnings"
            : "Add expense"
      }
      description={mode === "income" ? "Added to Savings." : undefined}
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)} className="entry-form">
        <Field label="Amount · PKR">
          <div className="amount-input">
            <span>Rs</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Amount in PKR"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
        </Field>
        {mode === "expense" && (
          <>
            <Field label="Category">
              <select
                aria-label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>
                  Choose category
                </option>
                {state.categories
                  .filter((c) => !c.archived || c.id === editing?.categoryId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            {category && (
              <div
                className={`funds-preview ${entered > available ? "shortfall" : ""}`}
              >
                <span>
                  {budget
                    ? "Budget available"
                    : "This category needs a funded budget"}
                </span>
                <strong>{formatMoney(available)}</strong>
                {entered > 0 && budget && (
                  <small>
                    {entered <= available
                      ? `${formatMoney(available - entered)} left after this`
                      : `${formatMoney(entered - available)} above your available budget. Increase the limit first.`}
                  </small>
                )}
              </div>
            )}
          </>
        )}
        <div className="form-two">
          <Field label="Date">
            <input
              aria-label="Transaction date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={localDate()}
              required
            />
          </Field>
          <Field label="Note · optional">
            <input
              aria-label="Transaction note"
              placeholder={mode === "income" ? "Salary" : "Lunch"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </Field>
        </div>
        {editing && editing.month !== state.activeMonth && (
          <p className="period-note">
            This records a correction in the current month. The original entry
            and date stay preserved.
          </p>
        )}
        <InlineError error={error} />
        <Submit pending={pending}>
          {editing
            ? "Save correction"
            : mode === "income"
              ? "Add to Savings"
              : "Record expense"}{" "}
          <ArrowUpRight size={17} />
        </Submit>
      </form>
    </Sheet>
  );
}

export function BudgetSheet({
  state,
  month,
  categoryId,
  dispatch,
  onClose,
  notify,
}: {
  state: FinanceState;
  month: string;
  categoryId?: string;
  dispatch: Dispatch;
  onClose: () => void;
  notify: Notify;
}) {
  const [category, setCategory] = useState(categoryId || "");
  const existing = state.budgets.find(
    (b) => b.categoryId === category && b.month === month,
  );
  const template = templateForMonth(state, category, month);
  const [amount, setAmount] = useState(() =>
    String((existing?.limit || template?.amount || 0) / 100 || ""),
  );
  const [scope, setScope] = useState<"month" | "month-and-future" | "future">(
    "month-and-future",
  );
  const [target, setTarget] = useState(month);
  const [custom, setCustom] = useState("");
  const [color, setColor] = useState(categoryColors[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  let value = 0;
  try {
    value = amount ? toMinor(amount) : 0;
  } catch {
    /* Validation on submit. */
  }
  const activeBudget = state.budgets.find(
    (b) => b.categoryId === category && b.month === target,
  );
  const difference =
    target > state.activeMonth || scope === "future"
      ? 0
      : value - (activeBudget?.limit || 0);
  const selectCategory = (id: string) => {
    setCategory(id);
    const found = state.budgets.find(
      (b) => b.categoryId === id && b.month === target,
    );
    const t = templateForMonth(state, id, target);
    setAmount(found || t ? String((found?.limit || t?.amount || 0) / 100) : "");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      let id = category;
      if (category === "__new") {
        const next = await dispatch({
          type: "add-category",
          name: custom,
          color,
          icon: "general",
        });
        id = next.categories.find(
          (c) => c.name.trim().toLowerCase() === custom.trim().toLowerCase(),
        )!.id;
      }
      await dispatch({
        type: "set-budget",
        categoryId: id,
        month: target,
        amount: toMinor(amount),
        scope,
      });
      notify(
        scope === "future" || target > state.activeMonth
          ? "Template saved · funds reserved next month"
          : "Budget saved",
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet
      title={categoryId ? "Adjust budget" : "New budget"}
      description="Reserves funds from Savings."
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)} className="entry-form">
        <Field label="Category">
          <select
            aria-label="Budget category"
            value={category}
            onChange={(e) => selectCategory(e.target.value)}
            required
          >
            <option value="" disabled>
              Choose category
            </option>
            {state.categories
              .filter((c) => !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            <option value="__new">＋ Create a new category</option>
          </select>
        </Field>
        {category === "__new" && (
          <>
            <Field label="Category name">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                required
                placeholder="Something that matters"
                maxLength={60}
              />
            </Field>
            <div className="color-picker" aria-label="Category color">
              {categoryColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ background: c }}
                  aria-label={`Choose ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                >
                  {color === c && <Check size={16} />}
                </button>
              ))}
            </div>
          </>
        )}
        <Field label="Monthly amount · PKR">
          <div className="amount-input">
            <span>Rs</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Monthly budget amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </Field>
        <Field label="Starting month">
          <input
            type="month"
            value={target}
            min={state.activeMonth}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </Field>
        <fieldset className="scope-picker">
          <legend>Applies to</legend>
          {(
            [
              {
                id: "month-and-future",
                title: "This month & the next ones",
                note: "Save as the recurring plan",
                icon: Repeat2,
              },
              {
                id: "month",
                title: "Just this month",
                note: "Keep the future template as it is",
                icon: Grid2X2,
              },
              {
                id: "future",
                title: "From next month",
                note: "Leave this month untouched",
                icon: ArrowRight,
              },
            ] as const
          ).map((item) => (
            <label
              key={item.id}
              className={scope === item.id ? "selected" : ""}
            >
              <input
                type="radio"
                name="scope"
                value={item.id}
                checked={scope === item.id}
                onChange={() => setScope(item.id)}
              />
              <item.icon size={17} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.note}</small>
              </span>
              <span className="radio-check">
                {scope === item.id && <Check size={11} />}
              </span>
            </label>
          ))}
        </fieldset>
        <div
          className={`funds-preview ${difference > savingsBalance(state) ? "shortfall" : ""}`}
        >
          <span>
            {difference > 0
              ? "To reserve from Savings"
              : difference < 0
                ? "To return to Savings"
                : "No funds move right now"}
          </span>
          <strong>{formatMoney(Math.abs(difference))}</strong>
        </div>
        <InlineError error={error} />
        <Submit pending={pending}>
          {existing ? "Save budget" : "Create budget"}{" "}
          <ArrowUpRight size={17} />
        </Submit>
      </form>
    </Sheet>
  );
}

export function CategoryDetail({
  state,
  categoryId,
  month,
  hidden,
  onClose,
  onExpense,
  onBudget,
  onTransaction,
  dispatch,
  notify,
}: {
  state: FinanceState;
  categoryId: string;
  month: string;
  hidden: boolean;
  onClose: () => void;
  onExpense: () => void;
  onBudget: () => void;
  onTransaction: (e: JournalEntry) => void;
  dispatch: Dispatch;
  notify: Notify;
}) {
  const cat = state.categories.find((c) => c.id === categoryId)!;
  const budget = state.budgets.find(
    (b) => b.categoryId === categoryId && b.month === month,
  );
  const entries = getActiveEntries(state)
    .filter((e) => e.categoryId === categoryId && e.month === month)
    .sort((a, b) => b.date.localeCompare(a.date));
  const [closing, setClosing] = useState(false);
  const [stop, setStop] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const remaining = budget ? budgetBalance(state, budget.id) : 0;
  const spent = budget
    ? budgetSpent(state, budget.id)
    : entries.reduce(
        (n, e) => n + (e.kind === "expense" ? e.amount : -e.amount),
        0,
      );
  const close = async () => {
    if (!budget) return;
    setPending(true);
    try {
      await dispatch({
        type: "archive-budget",
        budgetId: budget.id,
        stopRecurrence: stop,
      });
      notify("Envelope closed. Every expense is safely preserved.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet title={cat.name} description={monthLabel(month)} onClose={onClose}>
      <div
        className="category-detail"
        style={{ "--category": cat.color } as React.CSSProperties}
      >
        <p className="eyebrow">
          {budget?.status === "closed"
            ? "CLOSED · HISTORY PRESERVED"
            : "AVAILABLE"}
        </p>
        <Money value={remaining} hidden={hidden} className="detail-amount" />
        <div className="detail-stats">
          <div>
            <span>Spent</span>
            <Money value={spent} hidden={hidden} />
          </div>
          <div>
            <span>Monthly limit</span>
            <Money value={budget?.limit || 0} hidden={hidden} />
          </div>
        </div>
        <div className="action-pair">
          <button
            className="button primary"
            onClick={onExpense}
            disabled={
              !budget ||
              budget.status === "closed" ||
              month !== state.activeMonth ||
              remaining <= 0
            }
          >
            <Plus size={16} /> Add expense
          </button>
          <button className="button secondary" onClick={onBudget}>
            <Edit3 size={15} /> Adjust limit
          </button>
        </div>
        <div className="subsection-title">
          <History size={15} />
          <span>Expenses</span>
          <span>{entries.length}</span>
        </div>
        {entries.length ? (
          <Suspense
            fallback={
              <div className="ledger-loading" aria-label="Loading expenses" />
            }
          >
            <LedgerList
              entries={entries}
              hidden={hidden}
              onSelect={onTransaction}
            />
          </Suspense>
        ) : (
          <EmptyState
            title="No expenses"
            description="Expenses for this month appear here."
          />
        )}
        {budget?.status === "open" && month === state.activeMonth && (
          <div className="close-envelope">
            <button
              className="quiet-button danger-text"
              onClick={() => setClosing(!closing)}
            >
              <Trash2 size={14} /> Close budget
            </button>
            {closing && (
              <div className="confirm-box">
                <p>
                  {formatMoney(remaining)} returns to Savings. All expenses
                  remain in your history.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={stop}
                    onChange={(e) => setStop(e.target.checked)}
                  />{" "}
                  Also stop its recurring plan
                </label>
                <InlineError error={error} />
                <button
                  className="button danger"
                  disabled={pending}
                  onClick={() => void close()}
                >
                  Confirm close
                </button>
              </div>
            )}
          </div>
        )}
        {budget?.status === "closed" && month === state.activeMonth && (
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await dispatch({ type: "reopen-budget", budgetId: budget.id });
                notify("Envelope reopened. History intact.");
              } catch (err) {
                notify((err as Error).message, true);
              }
            }}
          >
            <RotateCcw size={15} /> Reopen budget
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function TransactionDetail({
  state,
  entry,
  dispatch,
  onClose,
  notify,
}: {
  state: FinanceState;
  entry: JournalEntry;
  dispatch: Dispatch;
  onClose: () => void;
  notify: Notify;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refund, setRefund] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const cat = state.categories.find((c) => c.id === entry.categoryId);
  const isIncome = entry.kind === "income";
  const reversed = isReversed(state, entry.id);
  const matches = useMemo(
    () =>
      getActiveEntries(state).filter(
        (e) =>
          e.kind === entry.kind &&
          (e.note || e.categoryId || "").trim().toLowerCase() ===
            (entry.note || entry.categoryId || "").trim().toLowerCase(),
      ),
    [state, entry],
  );
  const now = localDate();
  const seven = new Date(`${now}T12:00:00`);
  seven.setDate(seven.getDate() - 6);
  const week = localDate(seven);
  const sum = (from: string) =>
    matches
      .filter((e) => e.date >= from && e.date <= now)
      .reduce((n, e) => n + e.amount, 0);
  if (editing && (entry.kind === "expense" || isIncome))
    return (
      <EntrySheet
        state={state}
        mode={isIncome ? "income" : "expense"}
        dispatch={dispatch}
        onClose={onClose}
        notify={notify}
        editing={entry}
      />
    );
  const remove = async () => {
    setPending(true);
    try {
      await dispatch({ type: "reverse-entry", entryId: entry.id });
      notify("Reversed. Funds restored and the original preserved.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  const refundExpense = async () => {
    setPending(true);
    try {
      await dispatch({
        type: "refund-expense",
        entryId: entry.id,
        amount: toMinor(refund),
        date: now,
        note: `Refund · ${entry.note || cat?.name}`,
      });
      notify("Refund recorded. Funds returned to their place.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <Sheet
      title={
        entry.note || (isIncome ? "Earnings" : cat?.name || "Record details")
      }
      description={dateLabel(entry.date)}
      onClose={onClose}
    >
      <div className="transaction-detail">
        <div className={`entry-direction ${isIncome ? "income" : ""}`}>
          {isIncome ? <ArrowDownLeft size={27} /> : <ArrowUpRight size={27} />}
        </div>
        <Money value={entry.amount} className="detail-amount" />
        <span className="entry-type-label">
          {isIncome
            ? "Earnings → Savings"
            : entry.kind === "refund"
              ? "Refund"
              : cat?.name || "Legacy expense"}
        </span>
        {entry.legacyId && (
          <span className="legacy-label">
            <ShieldCheck size={12} /> Preserved from your original tracker
          </span>
        )}
        <div className="insight-grid">
          <div>
            <span>Times recorded</span>
            <strong>{matches.length}</strong>
          </div>
          <div>
            <span>Past 7 days</span>
            <Money value={sum(week)} />
          </div>
          <div>
            <span>This calendar month</span>
            <Money value={sum(`${now.slice(0, 7)}-01`)} />
          </div>
          <div>
            <span>This year</span>
            <Money value={sum(`${now.slice(0, 4)}-01-01`)} />
          </div>
        </div>
        {!reversed && (
          <>
            <div className="action-pair">
              {entry.kind !== "refund" && (
                <button
                  className="button secondary"
                  onClick={() => setEditing(true)}
                >
                  <Edit3 size={15} /> Correct record
                </button>
              )}
              <button
                className="button secondary danger-text"
                onClick={() => setConfirm(!confirm)}
              >
                <RotateCcw size={15} /> Reverse
              </button>
            </div>
            {entry.kind === "expense" && (
              <button
                className="quiet-button"
                onClick={() => setRefunding(!refunding)}
              >
                <ArrowDownLeft size={15} /> Record a refund
              </button>
            )}
          </>
        )}
        {reversed && (
          <p className="period-note">
            This record was reversed. Its original details remain preserved.
          </p>
        )}
        {confirm && (
          <div className="confirm-box">
            <p>
              Restore this money and reverse the record? Its original details
              remain in the journal.
            </p>
            <button
              className="button danger"
              disabled={pending}
              onClick={() => void remove()}
            >
              Confirm reversal
            </button>
          </div>
        )}
        {refunding && (
          <div className="confirm-box">
            <Field label="Refund amount · PKR">
              <input
                type="text"
                inputMode="decimal"
                value={refund}
                onChange={(e) => setRefund(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => void refundExpense()}
            >
              Save refund
            </button>
          </div>
        )}
        <InlineError error={error} />
      </div>
    </Sheet>
  );
}

export function SavingsSheet({
  state,
  hidden,
  onClose,
  onIncome,
}: {
  state: FinanceState;
  hidden: boolean;
  onClose: () => void;
  onIncome: () => void;
}) {
  const entries = useMemo(() => savingsTransactions(state), [state]);
  return (
    <Sheet title="Savings" onClose={onClose}>
      <div className="savings-detail">
        <section className="savings-balances" aria-label="Your money">
          <div>
            <span>Balance</span>
            <Money
              value={totalBalance(state)}
              hidden={hidden}
              className="balance-amount"
            />
            <small>Including unspent budgets</small>
          </div>
          <div>
            <span>Savings</span>
            <Money
              value={savingsBalance(state)}
              hidden={hidden}
              className="detail-amount"
            />
            <small>Available outside budgets</small>
          </div>
        </section>
        <button className="button primary" onClick={onIncome}>
          <Plus size={16} /> Add earnings
        </button>
        <div className="subsection-title">
          <Clock3 size={15} />
          <span>Savings transactions</span>
        </div>
        <Suspense
          fallback={
            <div
              className="ledger-loading"
              aria-label="Loading savings history"
            />
          }
        >
          <LedgerList
            entries={entries}
            hidden={hidden}
            savings
            categories={state.categories}
          />
        </Suspense>
        {!entries.length && (
          <EmptyState
            title="No earnings yet"
            description="New earnings are added to Savings."
          />
        )}
      </div>
    </Sheet>
  );
}
