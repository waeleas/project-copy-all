import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsViewer } from "@/hooks/use-is-viewer";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Car, ListChecks, Plus, Settings, LogOut, Loader2, User, Mail, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NetworkBanner } from "@/components/network-banner";
import { isQuietHours } from "@/lib/quiet-hours";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isViewer } = useIsViewer();
  const { canCreateTrips } = usePermissions();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    const check = () => setQuiet(isQuietHours());
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["messages-unread", user?.id],
    enabled: !!user?.id && !quiet,
    queryFn: async () => {
      // Direct unread messages
      const { count: directUnread } = await supabase
        .from("user_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .is("read_at", null);

      // Broadcasts: mark-as-read is stored per-user in localStorage
      const { data: broadcasts } = await supabase
        .from("user_messages")
        .select("id")
        .is("recipient_id", null);
      let readSet = new Set<string>();
      try {
        readSet = new Set(JSON.parse(localStorage.getItem(`msg.readBroadcasts.${user!.id}`) || "[]"));
      } catch {}
      const broadcastUnread = (broadcasts ?? []).filter((m: any) => !readSet.has(m.id)).length;

      return (directUnread ?? 0) + broadcastUnread;
    },
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Overdue open trips (> 23:59 since start) — remind every 6 hours
  const { data: overdue } = useQuery({
    queryKey: ["overdue-open-trip", user?.id],
    enabled: !!user?.id && !quiet,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - (23 * 60 + 59) * 60_000).toISOString();
      const { data } = await supabase
        .from("trips")
        .select("id, trip_no, start_at")
        .eq("created_by", user!.id)
        .eq("status", "open")
        .lt("start_at", cutoff)
        .order("start_at", { ascending: true })
        .limit(1);
      return data?.[0] ?? null;
    },
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const remindKey = user ? `overdueTrip.lastShown.${user.id}` : "";
  const [lastShown, setLastShown] = useState<number>(0);
  useEffect(() => {
    if (!remindKey) return;
    setLastShown(Number(localStorage.getItem(remindKey) || 0));
  }, [remindKey]);
  const showOverdue = !!overdue && now - lastShown >= 6 * 60 * 60_000;
  function dismissOverdue() {
    const t = Date.now();
    localStorage.setItem(remindKey, String(t));
    setLastShown(t);
  }

  if (quiet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="space-y-2">
          <p className="text-xl font-bold">البرنامج متوقف مؤقتًا</p>
          <p className="text-muted-foreground">يتوقف البرنامج يوميًا من 11:59 مساءً حتى 4:00 صباحًا لتوفير التشغيل. سيعود تلقائيًا بعد الساعة 4:00.</p>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const nav = [
    { to: "/", label: "الرحلات", icon: ListChecks },
    ...(canCreateTrips ? [{ to: "/trips/new", label: "رحلة جديدة", icon: Plus }] : []),
    { to: "/messages", label: "الرسائل", icon: Mail, badge: unreadCount },
    ...(isAdmin || isViewer ? [{ to: "/reports", label: "التقارير", icon: BarChart3 }] : []),
    { to: "/profile", label: "حسابي", icon: User },
    ...(isAdmin ? [{ to: "/manage", label: "الإدارة", icon: Settings }] : []),
  ];

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <NetworkBanner />
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Car className="size-5" />
            </div>
            <span className="hidden sm:inline">تتبع رحلات الخدمة</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/profile">
              <Button size="sm" variant="outline" className="gap-1">
                <User className="size-4" />
                <span className="text-sm">حسابي</span>
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={signOut}>
              <LogOut className="size-4 ml-1" /> خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 pb-24">{children}</main>

      {showOverdue && overdue && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl shadow-xl p-5 max-w-sm w-full text-center space-y-3">
            <div className="text-lg font-bold text-destructive">تنبيه: رحلة لم تُغلق</div>
            <p className="text-sm">
              الرحلة رقم #{overdue.trip_no} مفتوحة منذ أكثر من 23:59 ساعة. برجاء إغلاق الطلب.
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => {
                  dismissOverdue();
                  navigate({ to: "/trips/$id", params: { id: overdue.id } });
                }}
              >
                فتح الرحلة
              </Button>
              <Button variant="outline" onClick={dismissOverdue}>لاحقًا</Button>
            </div>
          </div>
        </div>
      )}




      <nav className="fixed bottom-0 inset-x-0 bg-card border-t z-30">
        <div className={`max-w-5xl mx-auto grid`} style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((n) => {
            const active = location.pathname === n.to;
            const Icon = n.icon;
            const badge = (n as any).badge as number | undefined;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`relative flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  active ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {n.label}
                {badge && badge > 0 ? (
                  <span className="absolute top-1 left-1/2 translate-x-3 bg-destructive text-destructive-foreground rounded-full text-[10px] min-w-4 h-4 px-1 flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
