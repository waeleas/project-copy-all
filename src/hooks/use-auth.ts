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

    return () => {
      subscription.unsubscribe();
      clearInterval(keepAlive);
    };
  }, []);

  return { session, user, loading };
}
