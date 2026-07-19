import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export function useIsViewer() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-viewer", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "viewer" as any)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });
  const loading = authLoading || (!!user?.id && isLoading);
  return { isViewer: !!data, loading };
}
