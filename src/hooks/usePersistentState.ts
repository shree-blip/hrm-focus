import { useCallback, useEffect, useState } from "react";

type InitialValue<T> = T | (() => T);

const getInitial = <T,>(storageKey: string, initialValue: InitialValue<T>): T => {
  const fallback = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export function usePersistentState<T>(storageKey: string, initialValue: InitialValue<T>) {
  const [value, setValue] = useState<T>(() => getInitial(storageKey, initialValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore localStorage write failures
    }
  }, [storageKey, value]);

  const reset = useCallback(() => {
    const fallback = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    setValue(fallback);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore localStorage remove failures
    }
  }, [initialValue, storageKey]);

  return [value, setValue, reset] as const;
}
