import { useEffect, useState } from "react";

// Ephemeral UI only. No financial data or credentials are stored here.
const views = new Map<string, unknown>();

export function useViewState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() =>
    views.has(key) ? (views.get(key) as T) : initial,
  );
  useEffect(() => {
    views.set(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
