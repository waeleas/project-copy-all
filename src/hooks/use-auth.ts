import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Keep the Supabase session alive in the background so the user stays
    // logged in until they explicitly press Sign Out.
    const keepAlive = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s) {
          setSession(s);
          setUser(s?.user ?? null);
        }
      });
    }, 4 * 60 * 1000);

    // When the app comes back from the background (especially in an APK
    // WebView), refresh the session immediately so the user is not logged out.
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (s) {
            setSession(s);
            setUser(s?.user ?? null);
          }
        });
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      subscription.unsubscribe();
      clearInterval(keepAlive);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);

  return { session, user, loading };
}
