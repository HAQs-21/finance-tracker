/** Run with: node --experimental-strip-types tests/domain.bench.ts */
import { performance } from "node:perf_hooks";
import {
  applyCommand,
  applyCommands,
  budgetBalance,
  createEmptyState,
  projectFinance,
  savingsBalance,
  validateState,
} from "../src/domain/index.ts";
import type { FinanceCommand } from "../src/domain/index.ts";

const context = { now: "2026-10-17T12:00:00Z" };
let state = applyCommand(
  createEmptyState("2026-10-17"),
  { type: "add-income", amount: 4_000_000, date: "2026-10-17" },
  context,
);
state = applyCommand(
  state,
  { type: "set-budget", categoryId: "food", month: "2026-10", amount: 800_000 },
  context,
);
const rows: FinanceCommand[] = Array.from({ length: 50_000 }, () => ({
  type: "add-expense",
  categoryId: "food",
  amount: 1,
  date: "2026-10-17",
}));
const measure = (label: string, work: () => void, iterations = 1) => {
  const timings: number[] = [];
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    work();
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  console.log(
    `${label}: median ${timings[Math.floor(timings.length / 2)].toFixed(2)} ms (${iterations} runs)`,
  );
};
measure("Atomic import of 50,000 expenses", () => {
  state = applyCommands(state, rows, context);
});
measure(
  "Cold single-pass projection / 50,002 entries",
  () => {
    projectFinance({ ...state, journal: [...state.journal] });
  },
  9,
);
measure(
  "10,000 cached Savings/category selector reads",
  () => {
    for (let index = 0; index < 10_000; index++) {
      savingsBalance(state);
      budgetBalance(state, state.budgets[0].id);
    }
  },
  9,
);
measure(
  "Single expense command / 50,002 entries",
  () => {
    applyCommand(
      state,
      {
        type: "add-expense",
        categoryId: "food",
        amount: 1,
        date: "2026-10-17",
      },
      context,
    );
  },
  9,
);
measure(
  "Full backup validation / 50,002 entries",
  () => {
    validateState(state);
  },
  5,
);
