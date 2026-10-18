import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";

export function UpdateNotice() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const applying = useRef(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const installed = () => {
      if (
        !disposed &&
        installing?.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        setWaiting(registration?.waiting || installing);
      }
    };
    const found = () => {
      installing?.removeEventListener("statechange", installed);
      installing = registration?.installing || null;
      installing?.addEventListener("statechange", installed);
    };
    const activated = () => {
      if (applying.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", activated);
    void navigator.serviceWorker.ready.then((value) => {
      if (disposed) return;
      registration = value;
      setWaiting(value.waiting);
      value.addEventListener("updatefound", found);
      found();
    });
    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", found);
      installing?.removeEventListener("statechange", installed);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        activated,
      );
    };
  }, []);
  if (!waiting) return null;
  return (
    <div className="period-note update-notice" role="status">
      <RefreshCw size={15} />
      <span>
        A fresh version of Morrow is ready. Your saved records stay here.
      </span>
      <button
        onClick={() => {
          applying.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Update & reopen <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
