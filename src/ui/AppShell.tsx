import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "motion/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  Grid2X2,
  History,
  Plus,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  localDate,
  type FinanceCommand,
  type FinanceState,
  type JournalEntry,
} from "../domain";
import { useFinanceStore } from "../data/store";
import { Logo } from "./brand";
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
};
const tabs = [
  { id: "plan" as const, label: "My plan", icon: Grid2X2 },
  { id: "activity" as const, label: "Activity", icon: History },
  { id: "insights" as const, label: "Insights", icon: ChartNoAxesCombined },
  { id: "settings" as const, label: "My space", icon: Settings2 },
];
function readPreferences(): Preferences {
  try {
    return {
      conceal: false,
      motion: "user",
      haptics: true,
      theme: "ink",
      ...JSON.parse(localStorage.getItem("morrow.preferences") || "{}"),
    };
  } catch {
    return { conceal: false, motion: "user", haptics: true, theme: "ink" };
  }
}
function initialTab(): Tab {
  const tab = window.location.hash.slice(1);
  return tabs.some((t) => t.id === tab) ? (tab as Tab) : "plan";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const [migrationVisible, setMigrationVisible] = useState(true);
  const [toast, setToast] = useState<{
    text: string;
    error: boolean;
    id: number;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!guide) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [guide]);
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
        /* Optional device capability. */
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
        error ? 7000 : 3800,
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
    const changed = () => setTab(initialTab());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.motion = preferences.motion;
    try {
      localStorage.setItem("morrow.preferences", JSON.stringify(preferences));
    } catch {
      /* Financial storage has independent error reporting. */
    }
  }, [preferences]);
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key === "k" &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        window.location.hash = "activity";
        setTimeout(
          () =>
            document.querySelector<HTMLInputElement>("[data-search]")?.focus(),
          150,
        );
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);
  const nativeBack = useEffectEvent(() => {
    if (guide) {
      setGuide(false);
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    if (document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return;
    }
    if (tab !== "plan") window.location.assign("#plan");
    else void import("@capacitor/app").then(({ App }) => App.minimizeApp());
  });
  useEffect(() => {
    let remove: (() => void) | undefined;
    let disposed = false;
    void import("@capacitor/app")
      .then(async ({ App }) => {
        const listener = await App.addListener("backButton", () =>
          nativeBack(),
        );
        if (disposed) void listener.remove();
        else remove = () => void listener.remove();
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      remove?.();
    };
  }, []);
  const navigate = (next: Tab) => {
    window.location.assign(`#${next}`);
    void haptic();
    setMenuOpen(false);
  };
  const openExpense = (id?: string) => {
    setCategory(null);
    setEntry({ type: "expense", categoryId: id });
    setMenuOpen(false);
  };
  const headerDate = new Date(`${localDate()}T12:00:00`).toLocaleDateString(
    "en",
    { weekday: "long", day: "numeric", month: "long" },
  );
  return (
    <MotionConfig reducedMotion={preferences.motion}>
      <LayoutGroup>
        <div className="app-layout">
          <aside className="sidebar">
            <a href="#plan" className="brand" aria-label="Morrow home">
              <Logo size={40} />
              <span className="wordmark">morrow</span>
            </a>
            <div className="sidebar-intro">
              A little intention.
              <br />A lot more possibility.
            </div>
            <nav aria-label="Main navigation">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`nav-item ${tab === item.id ? "active" : ""}`}
                  aria-current={tab === item.id ? "page" : undefined}
                >
                  {tab === item.id && (
                    <motion.span
                      layoutId="desktop-nav"
                      className="nav-background"
                    />
                  )}
                  <item.icon size={19} />
                  <span>{item.label}</span>
                  {tab === item.id && <span className="nav-dot" />}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="local-status">
                <span className="status-dot" />
                <span>Yours. Even offline.</span>
                <ShieldCheck size={14} />
              </div>
              <button onClick={() => setGuide(true)} className="quiet-button">
                <CircleHelp size={16} /> A quick introduction{" "}
                <ChevronRight size={14} />
              </button>
              <span className="version">MORROW / 01.00</span>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <a href="#plan" className="mobile-brand">
                <Logo size={27} />
                <span className="wordmark">morrow</span>
              </a>
              <div className="desktop-breadcrumb">
                Your everyday, thoughtfully arranged <span>/</span>{" "}
                {tabs.find((t) => t.id === tab)?.label}
              </div>
              <div className="topbar-actions">
                <span className="today-label">{headerDate}</span>
                <button
                  className="icon-button"
                  onClick={() =>
                    setPreferences((p) => ({ ...p, conceal: !p.conceal }))
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
                <button
                  className="avatar"
                  onClick={() => navigate("settings")}
                  aria-label="Open my space"
                >
                  M<span />
                </button>
              </div>
            </header>
            <main id="main-content" className="main-content">
              <UpdateNotice />
              {store.migrationReport && migrationVisible && (
                <div className="migration-notice">
                  <ShieldCheck size={19} />
                  <div>
                    <strong>Your history has a new home.</strong>
                    <span>
                      Existing records were preserved. Review the migration
                      report in My space.
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setMigrationVisible(false)}
                    aria-label="Dismiss migration notice"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <Suspense
                    fallback={
                      <div className="page-skeleton">
                        <div />
                        <div />
                        <div />
                      </div>
                    }
                  >
                    {tab === "plan" && (
                      <Plan
                        state={state}
                        month={month}
                        setMonth={setMonth}
                        hidden={preferences.conceal}
                        onIncome={() => setEntry({ type: "income" })}
                        onBudget={(id) => setBudget(id || true)}
                        onCategory={setCategory}
                        onSavings={() => setSavingsOpen(true)}
                        onExpense={openExpense}
                        dispatch={store.dispatch}
                        notify={notify}
                      />
                    )}
                    {tab === "activity" && (
                      <Activity
                        state={state}
                        hidden={preferences.conceal}
                        onSelect={setTransaction}
                        onAdd={openExpense}
                      />
                    )}
                    {tab === "insights" && (
                      <Insights state={state} hidden={preferences.conceal} />
                    )}
                    {tab === "settings" && (
                      <Settings
                        store={store}
                        preferences={preferences}
                        setPreferences={setPreferences}
                        notify={notify}
                        onRecover={onRecover}
                      />
                    )}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
              <footer className="page-footer">
                <Logo size={17} />
                <span>Make room for tomorrow.</span>
                <span className="footer-rule" />
                <span>Made for a little peace of mind.</span>
              </footer>
            </main>
          </div>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={tab === item.id ? "active" : ""}
              >
                {tab === item.id && (
                  <motion.span
                    layoutId="mobile-nav"
                    className="mobile-nav-highlight"
                  />
                )}
                <item.icon size={21} />
                <span>{item.id === "plan" ? "Plan" : item.label}</span>
              </button>
            ))}
          </nav>
          <div className="add-dock">
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className="add-menu"
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.94 }}
                >
                  <button onClick={() => openExpense()}>
                    <ArrowUpRight size={17} /> Record expense
                  </button>
                  <button
                    onClick={() => {
                      setEntry({ type: "income" });
                      setMenuOpen(false);
                    }}
                  >
                    <ArrowDownLeft size={17} /> Add earnings
                  </button>
                  <button
                    onClick={() => {
                      setBudget(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Grid2X2 size={17} /> Create a budget
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              className={`add-button ${menuOpen ? "opened" : ""}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label="Add transaction or budget"
            >
              <Plus size={23} />
              <span>Add new</span>
            </button>
          </div>
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
                month={month}
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
                month={month}
                hidden={preferences.conceal}
                onClose={() => setCategory(null)}
                onExpense={() => openExpense(category)}
                onBudget={() => {
                  setBudget(category);
                  setCategory(null);
                }}
                onTransaction={(t) => {
                  setTransaction(t);
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
                hidden={preferences.conceal}
                onClose={() => setSavingsOpen(false)}
                onIncome={() => {
                  setSavingsOpen(false);
                  setEntry({ type: "income" });
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
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12 }}
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
              aria-label="Welcome to Morrow"
            >
              <div className="guide-card">
                <Logo size={65} />
                <p className="eyebrow">A QUIETER WAY TO MONEY</p>
                <h2>
                  Tomorrow looks
                  <br />
                  <em>a little lighter.</em>
                </h2>
                <p>
                  Earnings land in Savings. Give each category a funded budget.
                  Spend what is there, and let next month take care of itself.
                </p>
                <div className="guide-steps">
                  <span>01 / Earn</span>
                  <ChevronRight size={15} />
                  <span>02 / Give it a place</span>
                  <ChevronRight size={15} />
                  <span>03 / Live a little</span>
                </div>
                <button
                  ref={guideButton}
                  className="button primary"
                  onClick={() => setGuide(false)}
                >
                  Make yourself at home <ArrowUpRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
