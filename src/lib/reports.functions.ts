import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdminOrViewer(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "viewer"]);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

type TripRow = {
  id: string;
  car_plate: string | null;
  car_code: string | null;
  car_description: string | null;
  car_type: string | null;
  driver_id: string | null;
  driver_name_rental: string | null;
  driver_name: string | null;
  driver_sap: string | null;
  created_by_name: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  governorate_id: string | null;
  governorate_name: string | null;
};

export type ReportRange = { from?: string | null; to?: string | null };

function parseRange(input: any): ReportRange {
  const from = input?.from ? String(input.from) : null;
  const to = input?.to ? String(input.to) : null;
  return { from, to };
}

async function fetchAllCompletedTrips(supabase: any, range: ReportRange): Promise<TripRow[]> {
  const all: TripRow[] = [];
  const PAGE = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase
      .from("trips")
      .select(
        "id, car_plate, car_code, car_description, car_type, driver_id, driver_name_rental, driver_name, driver_sap, created_by_name, start_odometer, end_odometer, start_at, end_at, status, governorate_id, governorate_name",
      )
      .not("end_odometer", "is", null);
    if (range.from) q = q.gte("start_at", range.from.includes("T") ? range.from : `${range.from}T00:00:00.000Z`);
    if (range.to) q = q.lte("start_at", range.to.includes("T") ? range.to : `${range.to}T23:59:59.999Z`);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as TripRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export const getCarKmReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReportRange) => parseRange(input))
  .handler(async ({ context, data }) => {
    await ensureAdminOrViewer(context.supabase, context.userId);
    const trips = await fetchAllCompletedTrips(context.supabase, data);
    const { data: carsData } = await context.supabase.from("cars").select("plate, code, description, type");
    const carByPlate = new Map<string, any>();
    (carsData ?? []).forEach((c: any) => carByPlate.set(String(c.plate ?? "").trim(), c));


    const map = new Map<
      string,
      {
        car_plate: string;
        car_code: string | null;
        car_description: string | null;
        car_type: string | null;
        trips_count: number;
        total_km: number;
        min_start: number;
        max_end: number;
        first_at: string | null;
        last_at: string | null;
        governorates: Set<string>;
      }
    >();

    for (const t of trips) {
      const plate = (t.car_plate ?? "").trim();
      if (!plate) continue;
      const start = Number(t.start_odometer ?? 0);
      const end = Number(t.end_odometer ?? 0);
      const dist = end > start ? end - start : 0;
      const key = plate;
      const prev = map.get(key);
      const master = carByPlate.get(plate);
      if (!prev) {
        map.set(key, {
          car_plate: plate,
          car_code: master?.code ?? t.car_code,
          car_description: master?.description ?? t.car_description,
          car_type: master?.type ?? t.car_type,
          trips_count: 1,
          total_km: dist,
          min_start: start || Number.POSITIVE_INFINITY,
          max_end: end,
          first_at: t.start_at,
          last_at: t.end_at,
          governorates: new Set(t.governorate_name ? [t.governorate_name] : []),
        });

      } else {
        prev.trips_count += 1;
        prev.total_km += dist;
        if (start && start < prev.min_start) prev.min_start = start;
        if (end > prev.max_end) prev.max_end = end;
        if (t.start_at && (!prev.first_at || t.start_at < prev.first_at)) prev.first_at = t.start_at;
        if (t.end_at && (!prev.last_at || t.end_at > prev.last_at)) prev.last_at = t.end_at;
        if (t.governorate_name) prev.governorates.add(t.governorate_name);
      }
    }

    // إدراج كل السيارات الموجودة في قاعدة البيانات حتى لو لم تعمل أي رحلة
    for (const c of carsData ?? []) {
      const plate = String(c.plate ?? "").trim();
      if (!plate || map.has(plate)) continue;
      map.set(plate, {
        car_plate: plate,
        car_code: c.code ?? null,
        car_description: c.description ?? null,
        car_type: c.type ?? null,
        trips_count: 0,
        total_km: 0,
        min_start: 0,
        max_end: 0,
        first_at: null,
        last_at: null,
        governorates: new Set<string>(),
      });
    }

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        min_start: r.min_start === Number.POSITIVE_INFINITY ? 0 : r.min_start,
        span_km: r.max_end - (r.min_start === Number.POSITIVE_INFINITY ? 0 : r.min_start),
        governorates: Array.from(r.governorates).join("، "),
      }))
      .sort((a, b) => b.total_km - a.total_km);

  });

export const getDriverKmReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReportRange) => parseRange(input))
  .handler(async ({ context, data }) => {
    await ensureAdminOrViewer(context.supabase, context.userId);
    const trips = await fetchAllCompletedTrips(context.supabase, data);

    // عدد المسارات الإضافية لكل رحلة (على دفعات لتجنب حدود الاستعلام)
    const tripIds = trips.map((t) => t.id).filter(Boolean);
    const segmentCounts = new Map<string, number>();
    const CHUNK = 100;
    for (let i = 0; i < tripIds.length; i += CHUNK) {
      const chunk = tripIds.slice(i, i + CHUNK);
      let offset = 0;
      const PAGE = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: segs, error } = await context.supabase
          .from("trip_segments")
          .select("trip_id")
          .in("trip_id", chunk)
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        (segs ?? []).forEach((s: any) => {
          segmentCounts.set(s.trip_id, (segmentCounts.get(s.trip_id) ?? 0) + 1);
        });
        if (!segs || segs.length < PAGE) break;
        offset += PAGE;
      }
    }


    // Resolve driver names
    const { data: driversData } = await context.supabase.from("drivers").select("id, name, sap_number");
    const driverById = new Map<string, { name: string; sap: string | null }>();
    const sapByName = new Map<string, string>();
    const normName = (s: string) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    (driversData ?? []).forEach((d: any) => {
      driverById.set(d.id, { name: d.name, sap: d.sap_number ?? null });
      const sap = String(d.sap_number ?? "").trim();
      if (sap && !sapByName.has(normName(d.name))) sapByName.set(normName(d.name), sap);
    });

    // أرقام الساب للفنيين والمديرين كبديل عند عدم وجودها في السائقين
    const { data: techData } = await context.supabase.from("technicians").select("name, sap_number");
    (techData ?? []).forEach((d: any) => {
      const sap = String(d.sap_number ?? "").trim();
      if (sap && !sapByName.has(normName(d.name))) sapByName.set(normName(d.name), sap);
    });
    const { data: mgrData } = await context.supabase.from("managers").select("name, sap_number");
    (mgrData ?? []).forEach((d: any) => {
      const sap = String(d.sap_number ?? "").trim();
      if (sap && !sapByName.has(normName(d.name))) sapByName.set(normName(d.name), sap);
    });


    const map = new Map<
      string,
      {
        driver_name: string;
        sap_number: string | null;
        trips_count: number;
        segments_count: number;
        total_km: number;
        first_at: string | null;
        last_at: string | null;
        governorates: Set<string>;
        days: Set<string>;
      }
    >();

    for (const t of trips) {
      let name = "";
      let sap: string | null = null;
      if (t.driver_id && driverById.has(t.driver_id)) {
        const d = driverById.get(t.driver_id)!;
        name = d.name;
        sap = d.sap;
      } else if (t.driver_name) {
        name = t.driver_name;
        sap = t.driver_sap ?? null;
      } else if (t.driver_name_rental) {
        name = t.driver_name_rental;
      } else if (t.created_by_name) {
        name = t.created_by_name;
      }
      name = (name ?? "").trim();
      if (!name) continue;
      if (!sap || !String(sap).trim()) sap = sapByName.get(normName(name)) ?? null;


      const start = Number(t.start_odometer ?? 0);
      const end = Number(t.end_odometer ?? 0);
      const dist = end > start ? end - start : 0;
      const key = `${name}::${sap ?? ""}`;
      const dayKey = t.start_at ? t.start_at.slice(0, 10) : null;
      const segCount = segmentCounts.get(t.id) ?? 0;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          driver_name: name,
          sap_number: sap,
          trips_count: 1,
          segments_count: segCount,
          total_km: dist,
          first_at: t.start_at,
          last_at: t.end_at,
          governorates: new Set(t.governorate_name ? [t.governorate_name] : []),
          days: new Set(dayKey ? [dayKey] : []),
        });
      } else {
        prev.trips_count += 1;
        prev.segments_count += segCount;
        prev.total_km += dist;
        if (t.start_at && (!prev.first_at || t.start_at < prev.first_at)) prev.first_at = t.start_at;
        if (t.end_at && (!prev.last_at || t.end_at > prev.last_at)) prev.last_at = t.end_at;
        if (t.governorate_name) prev.governorates.add(t.governorate_name);
        if (dayKey) prev.days.add(dayKey);
      }
    }

    return Array.from(map.values())
      .map((r) => ({ ...r, governorates: Array.from(r.governorates).join("، "), days_count: r.days.size }))
      .sort((a, b) => b.total_km - a.total_km);
  });

export const getCarDriverComparisonReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReportRange) => parseRange(input))
  .handler(async ({ context, data }) => {
    await ensureAdminOrViewer(context.supabase, context.userId);
    const trips = await fetchAllCompletedTrips(context.supabase, data);

    const { data: carsData } = await context.supabase.from("cars").select("plate, code, description, type");
    const carByPlate = new Map<string, any>();
    (carsData ?? []).forEach((c: any) => carByPlate.set(String(c.plate ?? "").trim(), c));

    const { data: driversData } = await context.supabase.from("drivers").select("id, name");
    const driverById = new Map<string, string>();
    (driversData ?? []).forEach((d: any) => driverById.set(d.id, d.name));

    type DriverBreakdown = { name: string; km: number; trips: number };

    type Row = {
      car_plate: string;
      car_code: string | null;
      car_description: string | null;
      car_type: string | null;
      trips_count: number;
      car_total_km: number;
      car_span_km: number;
      min_start: number;
      max_end: number;
      drivers_total_km: number;
      unassigned_km: number;
      unassigned_trips: number;
      diff_km: number;
      drivers_count: number;
      top_driver: string | null;
      top_driver_km: number;
      driver_breakdown: DriverBreakdown[];
      governorates: Set<string>;
    };

    const map = new Map<string, Row & { _drivers: Map<string, { km: number; trips: number }> }>();


    for (const t of trips) {
      const plate = (t.car_plate ?? "").trim();
      if (!plate) continue;
      const start = Number(t.start_odometer ?? 0);
      const end = Number(t.end_odometer ?? 0);
      const dist = end > start ? end - start : 0;

      let driverName = "";
      if (t.driver_id && driverById.has(t.driver_id)) driverName = driverById.get(t.driver_id)!;
      else if (t.driver_name) driverName = t.driver_name;
      else if (t.driver_name_rental) driverName = t.driver_name_rental;
      else if (t.created_by_name) driverName = t.created_by_name;
      driverName = (driverName ?? "").trim();

      const master = carByPlate.get(plate);
      let row = map.get(plate);
      if (!row) {
        row = {
          car_plate: plate,
          car_code: master?.code ?? t.car_code,
          car_description: master?.description ?? t.car_description,
          car_type: master?.type ?? t.car_type,
          trips_count: 0,
          car_total_km: 0,
          car_span_km: 0,
          min_start: Number.POSITIVE_INFINITY,
          max_end: 0,
          drivers_total_km: 0,
          unassigned_km: 0,
          unassigned_trips: 0,
          diff_km: 0,
          drivers_count: 0,
          top_driver: null,
          top_driver_km: 0,
          driver_breakdown: [],
          governorates: new Set<string>(),
          _drivers: new Map<string, { km: number; trips: number }>(),
        };
        map.set(plate, row);
      }
      row.trips_count += 1;
      row.car_total_km += dist;
      if (start && start < row.min_start) row.min_start = start;
      if (end > row.max_end) row.max_end = end;
      if (t.governorate_name) row.governorates.add(t.governorate_name);
      if (driverName) {
        row.drivers_total_km += dist;
        const prevD = row._drivers.get(driverName);
        row._drivers.set(driverName, { km: (prevD?.km ?? 0) + dist, trips: (prevD?.trips ?? 0) + 1 });
      } else {
        row.unassigned_km += dist;
        row.unassigned_trips += 1;
      }
    }


    return Array.from(map.values())
      .map(({ _drivers, ...r }) => {
        let top: string | null = null;
        let topKm = 0;
        const breakdown: DriverBreakdown[] = [];
        _drivers.forEach((v, name) => {
          breakdown.push({ name, km: v.km, trips: v.trips });
          if (v.km > topKm) {
            topKm = v.km;
            top = name;
          }
        });

        breakdown.sort((a, b) => b.km - a.km);
        const minStart = r.min_start === Number.POSITIVE_INFINITY ? 0 : r.min_start;
        const spanKm = Math.max(0, r.max_end - minStart);
        return {
          ...r,
          min_start: minStart,
          car_span_km: spanKm,
          drivers_count: _drivers.size,
          top_driver: top,
          top_driver_km: topKm,
          diff_km: spanKm - r.drivers_total_km,
          driver_breakdown: breakdown,
          governorates: Array.from(r.governorates).join("، "),
        };
      })
      .sort((a, b) => b.car_span_km - a.car_span_km);

  });
