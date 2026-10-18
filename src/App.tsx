import { lazy, Suspense, useState } from "react";
import { MotionConfig } from "motion/react";
import { useFinanceStore } from "./data/store";
import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/brand";
import "./ui/morrow.css";
import "./ui/refined.css";
const RecoveryScreen = lazy(() => import("./ui/RecoveryScreen"));
export default function App() {
  const store = useFinanceStore();
  const [recovering, setRecovering] = useState(false);
  if (store.status === "loading")
    return (
      <div className="boot-screen">
        <Logo size={60} />
        <span className="wordmark">morrow</span>
        <div className="boot-track" />
      </div>
    );
  if (store.status === "error" || recovering)
    return (
      <Suspense fallback={<div className="boot-screen">Opening recovery…</div>}>
        <RecoveryScreen
          error={store.error}
          onRestore={async (text) => {
            await store.replaceFromBackup(text);
            setRecovering(false);
          }}
          onRetry={() => {
            void store.refresh();
            setRecovering(false);
          }}
        />
      </Suspense>
    );
  if (!store.state) return null;
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
    >
      <AppShell store={store} onRecover={() => setRecovering(true)} />
    </MotionConfig>
  );
}
