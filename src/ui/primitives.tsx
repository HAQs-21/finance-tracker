import {
  memo,
  useLayoutEffect,
  useMemo,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  createElement,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotionConfig, useDragControls } from "motion/react";
import {
  X,
  Coffee,
  Car,
  House,
  Receipt,
  Heart,
  ShoppingBag,
  Gamepad2,
  Layers3,
  Briefcase,
  Gift,
  Utensils,
  Zap,
  Plane,
  Landmark,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import { formatMoney } from "../domain";

const icons: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-bag": ShoppingBag,
  house: House,
  zap: Zap,
  heart: Heart,
  play: Gamepad2,
  circle: CircleHelp,
  food: Utensils,
  coffee: Coffee,
  transport: Car,
  car: Car,
  rent: House,
  home: House,
  tax: Landmark,
  shopping: ShoppingBag,
  medical: Heart,
  health: Heart,
  entertainment: Gamepad2,
  utilities: Zap,
  salary: Briefcase,
  income: Briefcase,
  gift: Gift,
  travel: Plane,
  general: Layers3,
  others: CircleHelp,
  investments: Landmark,
  receipt: Receipt,
};
export function CategoryIcon({
  name,
  size = 20,
}: {
  name?: string;
  size?: number;
}) {
  return createElement(icons[(name || "general").toLowerCase()] || Layers3, {
    size,
    strokeWidth: 1.65,
    "aria-hidden": true,
  });
}
export const Money = memo(function Money({
  value,
  className = "",
  hidden = false,
}: {
  value: number;
  className?: string;
  hidden?: boolean;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduce = useReducedMotionConfig();
  const formatted = useMemo(() => formatMoney(value), [value]);
  useLayoutEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (reduce || hidden) return;
    const animation = element.current?.animate?.(
      [
        { transform: "translateY(5px)", opacity: 0.35 },
        { transform: "translateY(-1px)", opacity: 1, offset: 0.8 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
    );
    return () => animation?.cancel();
  }, [value, reduce, hidden]);
  return hidden ? (
    <span className={`money concealed ${className}`} aria-label="Amount hidden">
      ••••••
    </span>
  ) : (
    <span ref={element} className={`money ${className}`}>
      {formatted}
    </span>
  );
});
export function Sheet({
  children,
  title,
  description,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 620px)").matches,
  );
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 620px)");
    const changed = () => setCompact(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () =>
        (
          ref.current?.querySelector<HTMLElement>(
            '.sheet-body input:not([type="file"]), .sheet-body select, .sheet-body textarea, .sheet-body button',
          ) || ref.current?.querySelector<HTMLElement>("button")
        )?.focus(),
      160,
    );
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab" && ref.current) {
        const list = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
          ),
        );
        const first = list[0],
          last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <motion.div
      className="sheet-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.button
        className="sheet-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet ${wide ? "sheet-wide" : ""}`}
        drag={compact ? "y" : false}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.22 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 650) onClose();
        }}
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          className="sheet-grip"
          aria-label="Dismiss sheet"
          onPointerDown={(event) => controls.start(event)}
          onClick={onClose}
        />
        <header className="sheet-header">
          <div>
            <h2>{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function InlineError({ error }: { error?: string | null }) {
  return error ? (
    <p className="inline-error" role="alert">
      {error}
    </p>
  ) : null;
}
export function Submit({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className="button primary submit-button"
      type="submit"
      disabled={pending}
    >
      {pending ? (
        <>
          <span className="spinner" /> Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}
