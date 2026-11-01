import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { photoCutoff, PHOTO_PLACEHOLDER, isStoredPhoto, removablePhotoPaths } from "@/lib/photo-retention";

async function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!bearer) return false;
  const secret = process.env.PHOTO_PURGE_SECRET;
  if (secret && bearer === secret) return true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || bearer.split(".").length !== 3) return false;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(bearer);
  if (error || !data.user) return false;
  const { data: role, error: roleError } = await client.rpc("has_role", {
    _user_id: data.user.id, _role: "admin",
  });
  return !roleError && role === true;
}

async function purge() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = photoCutoff();
  const trips: Array<{ id: string; start_at: string; start_photo_url: string; end_photo_url: string | null }> = [];
  const segments: Array<{ id: string; trip_id: string; photo_url: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("trips")
      .select("id, start_at, start_photo_url, end_photo_url").order("id").range(offset, offset + 999);
    if (error) throw error;
    trips.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("trip_segments")
      .select("id, trip_id, photo_url").not("photo_url", "is", null).order("id").range(offset, offset + 999);
    if (error) throw error;
    segments.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const oldIds = new Set(trips.filter((t) => Date.parse(t.start_at) < Date.parse(cutoff)).map((t) => t.id));
  const oldSegments = segments.filter((s) => oldIds.has(s.trip_id) && isStoredPhoto(s.photo_url));
  const segmentTripIds = new Set(oldSegments.map((s) => s.trip_id));
  const tripRows = trips.filter((t) => oldIds.has(t.id) &&
    (isStoredPhoto(t.start_photo_url) || isStoredPhoto(t.end_photo_url) || segmentTripIds.has(t.id)));
  const oldPaths = tripRows.flatMap((t) => [t.start_photo_url, t.end_photo_url])
    .concat(oldSegments.map((s) => s.photo_url));
  const retainedPaths = trips.filter((t) => !oldIds.has(t.id)).flatMap((t) => [t.start_photo_url, t.end_photo_url])
    .concat(segments.filter((s) => !oldIds.has(s.trip_id)).map((s) => s.photo_url));
  const paths = removablePhotoPaths(oldPaths, retainedPaths);

  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmErr } = await supabaseAdmin.storage
      .from("odometer-photos")
      .remove(paths.slice(i, i + 100));
    if (rmErr) throw rmErr;
  }

  // start_photo_url is NOT NULL — point it at the placeholder image instead of nulling it
  for (let i = 0; i < tripRows.length; i += 100) {
    const { error } = await supabaseAdmin.from("trips")
      .update({ start_photo_url: PHOTO_PLACEHOLDER, end_photo_url: null })
      .in("id", tripRows.slice(i, i + 100).map((t) => t.id));
    if (error) throw error;
  }
  for (let i = 0; i < oldSegments.length; i += 100) {
    const { error } = await supabaseAdmin.from("trip_segments").update({ photo_url: null })
      .in("id", oldSegments.slice(i, i + 100).map((s) => s.id));
    if (error) throw error;
  }

  return { trips: tripRows.length, photos: paths.length };
}

export const Route = createFileRoute("/api/public/hooks/purge-old-photos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!(await authorized(request))) return Response.json({ error: "لم يتم السماح بطلب تنظيف الصور؛ يلزم دخول المشرف أو تصريح المهمة التلقائية" }, { status: 401 });
          const result = await purge();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("purge-old-photos failed", e?.message ?? e);
          return new Response(JSON.stringify({ ok: false, error: "تعذر تنظيف الصور؛ لم تكتمل العملية، يلزم مراجعة سجل الخدمة لمعرفة السبب" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
