import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ChartNoAxesCombined,
  Check,
  CircleHelp,
  Eye,
  EyeOff,
  Grid2X2,
  History,
  LockKeyhole,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import {
  type FinanceCommand,
  type FinanceState,
  type JournalEntry,
} from "../domain";
import { useFinanceStore } from "../data/store";
import {
  privateSavingsScreen,
  savingsPrivacyStatus,
  unlockSavings,
  type SavingsPrivacyStatus,
  type SavingsProtection,
} from "../data/privacy";
import { Logo } from "./brand";
import { MotionSpeed } from "./motionSpeed";
import { lockScroll } from "./scrollLock";
import { Plan } from "./Plan";
import { UpdateNotice } from "./UpdateNotice";
import {
  EntrySheet,
  BudgetSheet,
  CategoryDetail,
  TransactionDetail,
  SavingsSheet,
} from "./forms";

const Activity = lazy(() => import("./Activity"));
const Insights = lazy(() => import("./Insights"));
const Settings = lazy(() => import("./Settings"));
export type Tab = "plan" | "activity" | "insights" | "settings";
export type Notify = (message: string, error?: boolean) => void;
export type Dispatch = (command: FinanceCommand) => Promise<FinanceState>;
export type Preferences = {
  conceal: boolean;
  motion: "user" | "always";
  haptics: boolean;
  theme: "ink" | "charcoal";
  savingsProtection: SavingsProtection;
  animationSpeed: number;
};
const tabs = [
  { id: "plan" as const, label: "Budgets", icon: Grid2X2 },
  { id: "activity" as const, label: "Expenses", icon: History },
  { id: "insights" as const, label: "Insights", icon: ChartNoAxesCombined },
  { id: "settings" as const, label: "Settings", icon: Settings2 },
];
function readPreferences(): Preferences {
  const defaults: Preferences = {
    conceal: false,
    motion: "user",
    haptics: true,
    theme: "ink",
    savingsProtection: "auto",
    animationSpeed: 1,
  };
  try {
    const saved = {
      ...defaults,
      ...JSON.parse(localStorage.getItem("morrow.preferences") || "{}"),
    };
    saved.animationSpeed = Math.max(
      0.1,
      Math.min(5, Number(saved.animationSpeed) || 1),
    );
    return saved;
  } catch {
    return defaults;
  }
}
function initialTab(): Tab {
  const tab = window.location.hash.slice(1);
  return tabs.some((item) => item.id === tab) ? (tab as Tab) : "plan";
}

export function AppShell({
  store,
  onRecover,
}: {
  store: ReturnType<typeof useFinanceStore>;
  onRecover: () => void;
}) {
  const state = store.state!;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [month, setMonth] = useState(state.activeMonth);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [entry, setEntry] = useState<{
    type: "income" | "expense";
    categoryId?: string;
  } | null>(null);
  const [budget, setBudget] = useState<string | true | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<JournalEntry | null>(null);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [privacy, setPrivacy] = useState<SavingsPrivacyStatus>({
    native: false,
    available: false,
  });
  const [guide, setGuide] = useState(false);
  const [migrationVisible, setMigrationVisible] = useState(() => {
    try {
      return !localStorage.getItem(`morrow.migrationSeen.${state.id}`);
    } catch {
      return true;
    }
  });
  const [toast, setToast] = useState<{
    text: string;
    error: boolean;
    id: number;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideButton = useRef<HTMLButtonElement>(null);
  const haptic = useCallback(
    async (error = false) => {
      if (!preferences.haptics) return;
      try {
        const { Haptics, NotificationType, ImpactStyle } =
          await import("@capacitor/haptics");
        if (error)
          await Haptics.notification({ type: NotificationType.Warning });
        else await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        /* Optional hardware. */
      }
    },
    [preferences.haptics],
  );
  const notify = useCallback<Notify>(
    (text, error = false) => {
      setToast({ text, error, id: Date.now() });
      void haptic(error);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(
        () => setToast(null),
        error ? 6000 : 2200,
      );
    },
    [haptic],
  );
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.motion = preferences.motion;
    document.documentElement.style.setProperty(
      "--motion-duration",
      String(1 / preferences.animationSpeed),
    );
    try {
      localStorage.setItem("morrow.preferences", JSON.stringify(preferences));
    } catch {
      /* Ledger storage is independent. */
    }
  }, [preferences]);
  useEffect(() => {
    const changed = () => {
      setTab(initialTab());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const changed = () => {
      if (document.hidden) setSavingsOpen(false);
    };
    document.addEventListener("visibilitychange", changed);
    void savingsPrivacyStatus()
      .then(setPrivacy)
      .catch(() => undefined);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (savingsOpen) return;
    // Keep screenshots blocked until the closing sheet has left the screen.
    const timer = setTimeout(
      () => {
        void privateSavingsScreen(false).catch(() => undefined);
      },
      240 / preferences.animationSpeed + 60,
    );
    return () => clearTimeout(timer);
  }, [savingsOpen, preferences.animationSpeed]);
  useEffect(() => {
    if (!guide) return;
    const previous = document.activeElement as HTMLElement | null;
    const unlockScroll = lockScroll();
    guideButton.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuide(false);
      if (event.key === "Tab") {
        event.preventDefault();
        guideButton.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      unlockScroll();
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [guide]);
  const navigate = useCallback(
    (next: Tab) => {
      setTab(next);
      window.location.hash = next;
      window.scrollTo(0, 0);
      void haptic();
    },
    [haptic],
  );
  const showIncome = useCallback(() => setEntry({ type: "income" }), []);
  const showBudget = useCallback((id?: string) => setBudget(id || true), []);
  const openExpense = useCallback((id?: string) => {
    setCategory(null);
    setEntry({ type: "expense", categoryId: id });
  }, []);
  const showExpenses = useCallback(() => navigate("activity"), [navigate]);
  const showSavings = useCallback(async () => {
    setUnlocking(true);
    try {
      await unlockSavings(preferences.savingsProtection);
      await privateSavingsScreen(true);
      setSavingsOpen(true);
    } catch (error) {
      if ((error as { code?: string }).code !== "AUTH_CANCELLED")
        notify(error instanceof Error ? error.message : String(error), true);
    } finally {
      setUnlocking(false);
    }
  }, [preferences.savingsProtection, notify]);
  const closeSavings = useCallback(() => setSavingsOpen(false), []);
  const nativeBack = useEffectEvent(() => {
    if (guide) {
      setGuide(false);
      return;
    }
    if (document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return;
    }
    if (tab !== "plan") navigate("plan");
    else void import("@capacitor/app").then(({ App }) => App.minimizeApp());
  });
  useEffect(() => {
    let disposed = false;
    const removers: (() => void)[] = [];
    void import("@capacitor/app")
      .then(async ({ App }) => {
        for (const listener of [
          await App.addListener("backButton", () => nativeBack()),
          await App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) setSavingsOpen(false);
          }),
        ]) {
          if (disposed) void listener.remove();
          else removers.push(() => void listener.remove());
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      removers.forEach((remove) => remove());
    };
  }, []);
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key === "k" &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        navigate("activity");
        setTimeout(
          () =>
            document.querySelector<HTMLInputElement>("[data-search]")?.focus(),
          150,
        );
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [navigate]);
  const activeIndex = tabs.findIndex((item) => item.id === tab);
  return (
    <MotionSpeed value={preferences.animationSpeed}>
      <MotionConfig
        reducedMotion={preferences.motion}
        transition={{
          type: "tween",
          duration: 0.22 / preferences.animationSpeed,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="app-layout">
          <aside className="sidebar">
            <a href="#plan" className="brand" aria-label="Morrow home">
              <Logo size={30} />
              <span className="wordmark">morrow</span>
            </a>
            <nav aria-label="Main navigation">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`nav-item ${tab === item.id ? "active" : ""}`}
                  aria-current={tab === item.id ? "page" : undefined}
                >
                  <item.icon size={19} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button onClick={() => setGuide(true)} className="quiet-button">
                <CircleHelp size={16} /> How budgets work
              </button>
              <span className="version">Offline · 1.1.1</span>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <a href="#plan" className="mobile-brand">
                <Logo size={26} />
                <span className="wordmark">morrow</span>
              </a>
              <div className="topbar-actions">
                <button
                  className="savings-access"
                  onClick={() => void showSavings()}
                  disabled={unlocking}
                  aria-label="Open Savings"
                >
                  <LockKeyhole size={16} />
                  <span>{unlocking ? "Unlocking" : "Savings"}</span>
                </button>
                <button
                  className="icon-button"
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      conceal: !current.conceal,
                    }))
                  }
                  aria-label={
                    preferences.conceal ? "Show amounts" : "Hide amounts"
                  }
                  aria-pressed={preferences.conceal}
                >
                  {preferences.conceal ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </header>
            <main id="main-content" className="main-content">
              <UpdateNotice />
              {store.migrationReport && migrationVisible && (
                <div className="migration-notice">
                  <button onClick={() => navigate("settings")}>
                    History imported · Review report
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Dismiss migration notice"
                    onClick={() => {
                      setMigrationVisible(false);
                      try {
                        localStorage.setItem(
                          `morrow.migrationSeen.${state.id}`,
                          "1",
                        );
                      } catch {
                        /* Optional preference. */
                      }
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div key={tab} className="page-surface">
                <Suspense
                  fallback={
                    <div className="page-skeleton">
                      <div />
                      <div />
                    </div>
                  }
                >
                  {tab === "plan" && (
                    <Plan
                      state={state}
                      month={month === "all" ? state.activeMonth : month}
                      setMonth={setMonth}
                      hidden={preferences.conceal}
                      onIncome={showIncome}
                      onBudget={showBudget}
                      onCategory={setCategory}
                      onExpense={openExpense}
                      onExpenses={showExpenses}
                      dispatch={store.dispatch}
                      notify={notify}
                    />
                  )}
                  {tab === "activity" && (
                    <Activity
                      state={state}
                      month={month}
                      setMonth={setMonth}
                      hidden={preferences.conceal}
                      onSelect={setTransaction}
                      onAdd={openExpense}
                    />
                  )}
                  {tab === "insights" && (
                    <Insights
                      state={state}
                      month={month}
                      setMonth={setMonth}
                      hidden={preferences.conceal}
                    />
                  )}
                  {tab === "settings" && (
                    <Settings
                      store={store}
                      preferences={preferences}
                      setPreferences={setPreferences}
                      privacy={privacy}
                      notify={notify}
                      onRecover={onRecover}
                    />
                  )}
                </Suspense>
              </div>
            </main>
          </div>
          <nav
            className="mobile-nav"
            aria-label="Mobile navigation"
            style={{ "--tab-index": activeIndex } as CSSProperties}
          >
            <span className="nav-cursor" aria-hidden="true" />
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={tab === item.id ? "active" : ""}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          {(tab === "plan" || tab === "activity") && (
            <div className="add-dock">
              <button
                className="add-button"
                onClick={() => openExpense()}
                aria-label="Add expense"
              >
                <Plus size={22} />
                <span>Expense</span>
              </button>
            </div>
          )}
          <AnimatePresence>
            {entry && (
              <EntrySheet
                key={`${entry.type}-${entry.categoryId || ""}`}
                state={state}
                mode={entry.type}
                categoryId={entry.categoryId}
                dispatch={store.dispatch}
                onClose={() => setEntry(null)}
                notify={notify}
              />
            )}
            {budget && (
              <BudgetSheet
                key={String(budget)}
                state={state}
                month={month === "all" ? state.activeMonth : month}
                categoryId={typeof budget === "string" ? budget : undefined}
                dispatch={store.dispatch}
                onClose={() => setBudget(null)}
                notify={notify}
              />
            )}
            {category && (
              <CategoryDetail
                state={state}
                categoryId={category}
                month={month === "all" ? state.activeMonth : month}
                hidden={preferences.conceal}
                onClose={() => setCategory(null)}
                onExpense={() => openExpense(category)}
                onBudget={() => {
                  setBudget(category);
                  setCategory(null);
                }}
                onTransaction={(entry) => {
                  setTransaction(entry);
                  setCategory(null);
                }}
                dispatch={store.dispatch}
                notify={notify}
              />
            )}
            {transaction && (
              <TransactionDetail
                state={state}
                entry={transaction}
                dispatch={store.dispatch}
                onClose={() => setTransaction(null)}
                notify={notify}
              />
            )}
            {savingsOpen && (
              <SavingsSheet
                state={state}
                hidden={false}
                onClose={closeSavings}
                onIncome={() => {
                  setSavingsOpen(false);
                  showIncome();
                }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                className={`toast ${toast.error ? "error" : ""}`}
                role={toast.error ? "alert" : "status"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 / preferences.animationSpeed }}
              >
                <span className="toast-icon">
                  {toast.error ? <CircleHelp size={17} /> : <Check size={17} />}
                </span>
                <span>{toast.text}</span>
                <button
                  onClick={() => setToast(null)}
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {guide && (
            <div
              className="guide-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="How budgets work"
            >
              <div className="guide-card">
                <h2>How budgets work</h2>
                <ol>
                  <li>Earnings go to Savings.</li>
                  <li>A budget reserves its limit from Savings.</li>
                  <li>Expenses use that category’s funds.</li>
                  <li>Templates repeat next month; past limits stay fixed.</li>
                </ol>
                <button
                  ref={guideButton}
                  className="button primary"
                  onClick={() => setGuide(false)}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </MotionConfig>
    </MotionSpeed>
  );
}
