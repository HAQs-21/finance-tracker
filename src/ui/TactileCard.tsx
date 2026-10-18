import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotionConfig,
  useSpring,
  type HTMLMotionProps,
} from "motion/react";

/** Pointer motion updates compositor values directly, without React renders. */
export function TactileCard({ style, ...props }: HTMLMotionProps<"article">) {
  const bounds = useRef<DOMRect | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 250, damping: 28 });
  const rotateY = useSpring(y, { stiffness: 250, damping: 28 });
  const reduced = useReducedMotionConfig();
  return (
    <motion.article
      {...props}
      style={{ ...style, rotateX, rotateY, transformPerspective: 1100 }}
      whileTap={{ scale: reduced ? 1 : 0.99 }}
      onPointerEnter={(event) => {
        bounds.current = event.currentTarget.getBoundingClientRect();
      }}
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== "mouse" || !bounds.current) return;
        const rect = bounds.current;
        x.set(((event.clientY - rect.top) / rect.height - 0.5) * -3);
        y.set(((event.clientX - rect.left) / rect.width - 0.5) * 3);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    />
  );
}
