import { useEffect, useState } from "react";

/** حالة تُحفظ في sessionStorage حتى لا تُفقد عند تغيير التبويب أو التنقل داخل نفس الجلسة. */
export function usePersistedState<T>(key: string, initial: T) {
  const storageKey = `form:${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [storageKey, value]);

  return [value, setValue, () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
  }] as const;
}
