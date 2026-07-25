import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * شريط علوي يظهر عندما يفقد المستخدم الاتصال بالإنترنت
 * أو عند اكتشاف اتصال بطيء (2g/slow-2g) — مهم للسائقين ذوي الباقات الضعيفة.
 */
export function NetworkBanner() {
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const conn = (navigator as any).connection;
    const checkSlow = () => {
      if (!conn) return;
      const eff = conn.effectiveType as string | undefined;
      setSlow(eff === "slow-2g" || eff === "2g");
    };
    checkSlow();
    conn?.addEventListener?.("change", checkSlow);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      conn?.removeEventListener?.("change", checkSlow);
    };
  }, []);

  if (online && !slow) return null;

  return (
    <div
      className={`w-full text-center text-xs sm:text-sm py-2 px-3 flex items-center justify-center gap-2 ${
        online ? "bg-amber-500/15 text-amber-900 dark:text-amber-200" : "bg-destructive/15 text-destructive"
      }`}
      role="status"
      aria-live="polite"
    >
      {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
      <span>
        {online
          ? "الاتصال بالإنترنت ضعيف — قد يستغرق الرفع وقتاً أطول"
          : "لا يوجد اتصال بالإنترنت — تحقق من الشبكة"}
      </span>
    </div>
  );
}
