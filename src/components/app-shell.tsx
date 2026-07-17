import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Car, ListChecks, Plus, Settings, LogOut, Loader2, User } from "lucide-react";
import { useEffect } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canCreateTrips } = usePermissions();
  const navigate = useNavigate();
  const { location } = useRouterState();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

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
    { to: "/profile", label: "حسابي", icon: User },
    ...(isAdmin ? [{ to: "/manage", label: "الإدارة", icon: Settings }] : []),
  ];

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
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

      <nav className="fixed bottom-0 inset-x-0 bg-card border-t z-30">
        <div className={`max-w-5xl mx-auto grid ${nav.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {nav.map((n) => {
            const active = location.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  active ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
