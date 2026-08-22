import React, { createContext, useContext, useState, useCallback } from 'react';
import { triggerHaptic, type HapticType } from '../hooks/useHaptic';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  haptic?: HapticType;
}

interface ToastContextValue {
  showToast: (message: string, type?: 'success' | 'error' | 'info', haptic?: HapticType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {}
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', haptic?: HapticType) => {
    const id = Math.random().toString(36).substring(2, 9);
    triggerHaptic(haptic || (type === 'success' ? 'success' : type === 'error' ? 'error' : 'light'));

    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Floating Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-xs px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-2.5 px-4 py-3 rounded-2xl border text-xs font-semibold shadow-2xl backdrop-blur-xl animate-fade-in ${
              toast.type === 'success'
                ? 'bg-[#101014]/95 text-emerald-400 border-emerald-500/30 shadow-emerald-950/40'
                : toast.type === 'error'
                ? 'bg-[#101014]/95 text-rose-400 border-rose-500/30 shadow-rose-950/40'
                : 'bg-[#101014]/95 text-zinc-200 border-white/10 shadow-black/80'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {toast.type === 'success' && <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle size={15} className="shrink-0 text-rose-400" />}
              {toast.type === 'info' && <Info size={15} className="shrink-0 text-primary" />}
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
