import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  car_code: z.string().max(40).optional().default(""),
  car_plate: z.string().max(40).optional().default(""),
});

// آخر رحلة مغلقة للسيارة (من جميع السائقين) مع رابط موقّع لصورة عداد النهاية
export const getLastClosedTripPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const code = data.car_code.trim();
    const plate = data.car_plate.trim();
    if (!code && !plate) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("trips")
      .select("trip_no, end_odometer, end_photo_url, start_photo_url, end_at")
      .eq("status", "closed")
      .order("end_at", { ascending: false })
      .limit(1);
    if (code) q = q.eq("car_code", code);
    else q = q.eq("car_plate", plate);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const last: any = rows?.[0];
    if (!last) return null;
    const path: string | null = last.end_photo_url ?? last.start_photo_url ?? null;
    let url: string | null = null;
    if (path) {
      if (/^https?:\/\//i.test(path) || path.startsWith("/")) url = path;
      else {
        const { data: s } = await supabaseAdmin.storage
          .from("odometer-photos")
          .createSignedUrl(path, 60 * 10);
        url = s?.signedUrl ?? null;
      }
    }
    return {
      trip_no: last.trip_no as number,
      end_odometer: last.end_odometer as number | null,
      photo_url: url,
    };
  });
