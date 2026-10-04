import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  car_code: z.string().max(40).optional().default(""),
  car_plate: z.string().max(40).optional().default(""),
});

// آخر قراءة للسيارة (بنفس منطق last_odometer_for_car) مع صورة العداد المطابقة لها
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
      .select("trip_no, start_odometer, end_odometer, end_photo_url, start_photo_url, start_at, end_at")
      .order("start_at", { ascending: false })
      .limit(30);
    if (code) q = q.eq("car_code", code);
    else q = q.eq("car_plate", plate);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const sorted = (rows ?? []).slice().sort((a: any, b: any) => {
      const ta = new Date(a.end_at ?? a.start_at).getTime();
      const tb = new Date(b.end_at ?? b.start_at).getTime();
      return tb - ta || Number(b.trip_no) - Number(a.trip_no);
    });
    const last: any = sorted[0];
    if (!last) return null;
    const reading: number | null = last.end_odometer ?? last.start_odometer ?? null;
    const path: string | null =
      last.end_odometer != null ? (last.end_photo_url ?? null) : (last.start_photo_url ?? null);
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
    return { trip_no: last.trip_no as number, end_odometer: reading, photo_path: path, photo_url: url };
  });
