import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useIsAdmin } from "./use-is-admin";

/**
 * Resolves per-user permissions by combining app_settings with the profile
 * override columns. Admins always get full access.
 */
export function usePermissions() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("rental_cars_visible, trip_creation_enabled")
        .eq("id", true)
        .maybeSingle();
      return {
        rental_cars_visible: (data as any)?.rental_cars_visible ?? true,
        trip_creation_enabled: (data as any)?.trip_creation_enabled ?? true,
      };
    },
    staleTime: 30_000,
  });

  const profile = useQuery({
    queryKey: ["profile-overrides", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("rental_cars_override, trip_create_override")
        .eq("user_id", user!.id)
        .maybeSingle();
      return {
        rental_cars_override: (data as any)?.rental_cars_override ?? null,
        trip_create_override: (data as any)?.trip_create_override ?? null,
      };
    },
    staleTime: 30_000,
  });

  const loading =
    authLoading || adminLoading || settings.isLoading || (!!user?.id && profile.isLoading);

  const canSeeRentals =
    isAdmin ||
    (profile.data?.rental_cars_override ??
      settings.data?.rental_cars_visible ??
      true);

  const canCreateTrips =
    isAdmin ||
    (profile.data?.trip_create_override ??
      settings.data?.trip_creation_enabled ??
      true);

  return { loading, canSeeRentals, canCreateTrips, isAdmin };
}
