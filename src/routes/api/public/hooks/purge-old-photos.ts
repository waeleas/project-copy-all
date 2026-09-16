import { createFileRoute } from "@tanstack/react-router";

const RETENTION_DAYS = 90;
const BATCH = 500;

async function purge() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: trips, error } = await supabaseAdmin
    .from("trips")
    .select("id, start_photo_url, end_photo_url")
    .lt("start_at", cutoff)
    .or("start_photo_url.not.is.null,end_photo_url.not.is.null")
    .limit(BATCH);
  if (error) throw error;

  const tripRows = trips ?? [];
  if (tripRows.length === 0) return { trips: 0, photos: 0 };

  const ids = tripRows.map((t) => t.id);
  const { data: segments, error: segErr } = await supabaseAdmin
    .from("trip_segments")
    .select("id, photo_url")
    .in("trip_id", ids)
    .not("photo_url", "is", null);
  if (segErr) throw segErr;

  const paths: string[] = [];
  const isBucketPath = (p?: string | null) => !!p && !/^https?:\/\//i.test(p) && !p.startsWith("/");
  for (const t of tripRows) {
    if (isBucketPath(t.start_photo_url)) paths.push(t.start_photo_url as string);
    if (isBucketPath(t.end_photo_url)) paths.push(t.end_photo_url as string);
  }
  for (const s of segments ?? []) {
    if (isBucketPath(s.photo_url)) paths.push(s.photo_url as string);
  }

  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmErr } = await supabaseAdmin.storage
      .from("odometer-photos")
      .remove(paths.slice(i, i + 100));
    if (rmErr) console.error("storage remove failed", rmErr.message);
  }

  // start_photo_url is NOT NULL — point it at the placeholder image instead of nulling it
  const PLACEHOLDER = "/__l5e/assets-v1/810396f8-fc18-43c7-a50a-5ec200bf8815/odometer-placeholder.jpg";
  await supabaseAdmin
    .from("trips")
    .update({ start_photo_url: PLACEHOLDER, end_photo_url: null })
    .in("id", ids);
  if ((segments ?? []).length > 0) {
    await supabaseAdmin
      .from("trip_segments")
      .update({ photo_url: null })
      .in("id", (segments ?? []).map((s) => s.id));
  }

  return { trips: tripRows.length, photos: paths.length };
}

export const Route = createFileRoute("/api/public/hooks/purge-old-photos")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await purge();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("purge-old-photos failed", e?.message ?? e);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
