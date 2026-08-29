import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const TABLE_ORDER = [
  "app_settings",
  "offices",
  "managers",
  "technicians",
  "drivers",
  "cars",
  "service_types",
  "profiles",
  "user_roles",
  "trips",
  "trip_segments",
  "user_messages",
] as const;

const schema = z.object({
  table: z.string(),
  rows: z.array(z.record(z.string(), z.any())).max(500),
});

export const restoreChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(TABLE_ORDER as readonly string[]).includes(data.table)) {
      throw new Error("Unknown table");
    }

    const { data: adminCheck } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminCheck) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    if (data.rows.length === 0) return { inserted, skipped, errors };

    const { error } = await (supabaseAdmin as any)
      .from(data.table)
      .upsert(data.rows, { onConflict: "id", ignoreDuplicates: false });

    if (error) {
      // fallback: row-by-row so a single bad row (e.g. FK failure) doesn't drop the chunk
      for (const row of data.rows) {
        const { error: e2 } = await (supabaseAdmin as any)
          .from(data.table)
          .upsert(row, { onConflict: "id", ignoreDuplicates: false });
        if (e2) {
          skipped++;
          if (errors.length < 5) errors.push(e2.message);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += data.rows.length;
    }

    return { inserted, skipped, errors };
  });
