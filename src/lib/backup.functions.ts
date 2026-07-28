import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TABLE_ORDER = [
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
  data: z.record(z.string(), z.array(z.record(z.string(), z.any()))),
});

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: adminCheck } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminCheck) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const report: Record<string, { inserted: number; skipped: number; errors: string[] }> = {};

    for (const table of TABLE_ORDER) {
      const rows = data.data[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        report[table] = { inserted: 0, skipped: 0, errors: [] };
        continue;
      }
      let inserted = 0;
      let skipped = 0;
      const errors: string[] = [];
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await (supabaseAdmin as any)
          .from(table)
          .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
        if (error) {
          // fallback: try one-by-one to skip bad rows (e.g. FK failures)
          for (const row of chunk) {
            const { error: e2 } = await (supabaseAdmin as any)
              .from(table)
              .upsert(row, { onConflict: "id", ignoreDuplicates: false });
            if (e2) {
              skipped++;
              if (errors.length < 5) errors.push(e2.message);
            } else {
              inserted++;
            }
          }
        } else {
          inserted += chunk.length;
        }
      }
      report[table] = { inserted, skipped, errors };
    }

    return { ok: true, report };
  });
