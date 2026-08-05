import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Car as CarIcon, User as UserIcon, GitCompare } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsViewer } from "@/hooks/use-is-viewer";
import { toast } from "sonner";
import { getCarKmReport, getDriverKmReport, getCarDriverComparisonReport } from "@/lib/reports.functions";
import { exportToXlsx } from "@/components/data-toolbar";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "التقارير" }] }),
  component: () => (
    <AppShell>
      <ReportsPage />
    </AppShell>
  ),
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function ReportsPage() {
  const { isAdmin, loading: la } = useIsAdmin();
  const { isViewer, loading: lv } = useIsViewer();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });

  useEffect(() => {
    if (!la && !lv && !isAdmin && !isViewer) {
      toast.error("هذه الصفحة للأدمن أو مستخدم الاطلاع فقط");
      navigate({ to: "/" });
    }
  }, [la, lv, isAdmin, isViewer, navigate]);

  const carsFn = useServerFn(getCarKmReport);
  const driversFn = useServerFn(getDriverKmReport);
  const compareFn = useServerFn(getCarDriverComparisonReport);

  const cars = useQuery({
    queryKey: ["report", "cars", range.from, range.to],
    queryFn: () => carsFn({ data: range }),
  });
  const drivers = useQuery({
    queryKey: ["report", "drivers", range.from, range.to],
    queryFn: () => driversFn({ data: range }),
  });
  const compare = useQuery({
    queryKey: ["report", "compare", range.from, range.to],
    queryFn: () => compareFn({ data: range }),
  });

  function applyRange() {
    if (from && to && from > to) {
      toast.error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
      return;
    }
    setRange({ from: from || null, to: to || null });
  }

  function clearRange() {
    setFrom("");
    setTo("");
    setRange({ from: null, to: null });
  }

  const carsFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = cars.data ?? [];
    if (!s) return list;
    return list.filter(
      (r: any) =>
        (r.car_plate ?? "").toLowerCase().includes(s) ||
        (r.car_code ?? "").toLowerCase().includes(s) ||
        (r.car_description ?? "").toLowerCase().includes(s) ||
        (r.governorates ?? "").toLowerCase().includes(s),
    );
  }, [cars.data, q]);

  const driversFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = drivers.data ?? [];
    if (!s) return list;
    return list.filter(
      (r: any) =>
        (r.driver_name ?? "").toLowerCase().includes(s) ||
        (r.sap_number ?? "").toLowerCase().includes(s) ||
        (r.governorates ?? "").toLowerCase().includes(s),
    );
  }, [drivers.data, q]);

  const compareFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = compare.data ?? [];
    if (!s) return list;
    return list.filter(
      (r: any) =>
        (r.car_plate ?? "").toLowerCase().includes(s) ||
        (r.car_code ?? "").toLowerCase().includes(s) ||
        (r.car_description ?? "").toLowerCase().includes(s) ||
        (r.governorates ?? "").toLowerCase().includes(s) ||
        (r.top_driver ?? "").toLowerCase().includes(s) ||
        (r.driver_breakdown ?? []).some((d: any) => (d.name ?? "").toLowerCase().includes(s)),
    );
  }, [compare.data, q]);

  const totalCarsKm = (cars.data ?? []).reduce((s: number, r: any) => s + r.total_km, 0);
  const totalDriversKm = (drivers.data ?? []).reduce((s: number, r: any) => s + r.total_km, 0);

  // إجماليات تبويب المقارنة تُحسب من نفس صفوف المقارنة حتى تتطابق مع التفصيل لكل سيارة
  // السيارات: من أول عداد إلى آخر عداد (span) — السائقون: مجموع كيلومترات الرحلات المكتملة
  const cmpCarsKm = (compare.data ?? []).reduce((s: number, r: any) => s + (r.car_span_km ?? 0), 0);
  const cmpCarsTripsKm = (compare.data ?? []).reduce((s: number, r: any) => s + (r.car_total_km ?? 0), 0);
  const cmpDriversKm = (compare.data ?? []).reduce((s: number, r: any) => s + (r.drivers_total_km ?? 0), 0);
  const cmpUnassignedKm = (compare.data ?? []).reduce((s: number, r: any) => s + (r.unassigned_km ?? 0), 0);
  const totalDiffKm = cmpCarsKm - cmpDriversKm;



  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">التقارير</h1>
        <p className="text-sm text-muted-foreground">
          إجمالي الكيلومترات لكل سيارة ولكل سائق (من الرحلات المكتملة)
          {range.from || range.to ? ` — الفترة: ${range.from || "البداية"} إلى ${range.to || "اليوم"}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">من تاريخ</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">إلى تاريخ</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button size="sm" onClick={applyRange}>تطبيق</Button>
        <Button size="sm" variant="outline" onClick={clearRange}>الكل</Button>
        <Input
          placeholder="بحث..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>


      <Tabs defaultValue="cars">
        <TabsList>
          <TabsTrigger value="cars"><CarIcon className="size-4 ml-1" /> السيارات</TabsTrigger>
          <TabsTrigger value="drivers"><UserIcon className="size-4 ml-1" /> السائقون</TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="size-4 ml-1" /> المقارنة</TabsTrigger>
        </TabsList>

        <TabsContent value="cars">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                السيارات — الإجمالي: {fmt(totalCarsKm)} كم
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportToXlsx(
                    "car-km-report",
                    carsFiltered.map((r: any) => ({
                      "رقم اللوحة": r.car_plate,
                      "كود السيارة": r.car_code ?? "",
                      "الوصف": r.car_description ?? "",
                      "النوع": r.car_type === "rental" ? "إيجار" : "شركة",
                      "المحافظة": r.governorates ?? "",
                      "عدد الرحلات": r.trips_count,
                      "إجمالي الكيلومترات": Math.round(r.total_km),
                      "أول عداد": Math.round(r.min_start),
                      "آخر عداد": Math.round(r.max_end),
                      "الفرق (آخر − أول)": Math.round(r.span_km),
                    })),
                  )
                }
              >
                <Download className="size-4 ml-1" /> Excel
              </Button>
            </CardHeader>
            <CardContent>
              {cars.isLoading ? (
                <Loader2 className="size-6 animate-spin mx-auto text-primary" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-right border-b">
                      <tr>
                        <th className="p-2">اللوحة</th>
                        <th className="p-2">الكود</th>
                        <th className="p-2">الوصف</th>
                        <th className="p-2">النوع</th>
                        <th className="p-2">المحافظة</th>
                        <th className="p-2">الرحلات</th>
                        <th className="p-2">إجمالي كم</th>
                        <th className="p-2">أول عداد</th>
                        <th className="p-2">آخر عداد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carsFiltered.map((r: any) => (
                        <tr key={r.car_plate} className="border-b hover:bg-muted/40">
                          <td className="p-2 font-semibold">{r.car_plate}</td>
                          <td className="p-2">{r.car_code ?? "-"}</td>
                          <td className="p-2">{r.car_description ?? "-"}</td>
                          <td className="p-2">{r.car_type === "rental" ? "إيجار" : "شركة"}</td>
                          <td className="p-2">{r.governorates ?? "-"}</td>
                          <td className="p-2">{r.trips_count}</td>
                          <td className="p-2 font-bold text-primary">{fmt(r.total_km)}</td>
                          <td className="p-2">{fmt(r.min_start)}</td>
                          <td className="p-2">{fmt(r.max_end)}</td>
                        </tr>
                      ))}
                      {carsFiltered.length === 0 && (
                        <tr><td colSpan={9} className="text-center p-4 text-muted-foreground">لا توجد بيانات</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                السائقون — الإجمالي: {fmt(totalDriversKm)} كم
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportToXlsx(
                    "driver-km-report",
                    driversFiltered.map((r: any) => ({
                      "اسم السائق": r.driver_name,
                      "رقم الساب": r.sap_number ?? "",
                      "عدد الرحلات": r.trips_count,
                      "إجمالي الكيلومترات": Math.round(r.total_km),
                    })),
                  )
                }
              >
                <Download className="size-4 ml-1" /> Excel
              </Button>
            </CardHeader>
            <CardContent>
              {drivers.isLoading ? (
                <Loader2 className="size-6 animate-spin mx-auto text-primary" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-right border-b">
                      <tr>
                        <th className="p-2">السائق</th>
                        <th className="p-2">رقم الساب</th>
                        <th className="p-2">الرحلات</th>
                        <th className="p-2">إجمالي كم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driversFiltered.map((r: any) => (
                        <tr key={`${r.driver_name}-${r.sap_number ?? ""}`} className="border-b hover:bg-muted/40">
                          <td className="p-2 font-semibold">{r.driver_name}</td>
                          <td className="p-2">{r.sap_number ?? "-"}</td>
                          <td className="p-2">{r.trips_count}</td>
                          <td className="p-2 font-bold text-primary">{fmt(r.total_km)}</td>
                        </tr>
                      ))}
                      {driversFiltered.length === 0 && (
                        <tr><td colSpan={4} className="text-center p-4 text-muted-foreground">لا توجد بيانات</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">إجمالي مسافة السيارات (من أول عداد لآخر عداد)</div>
                <div className="text-xl font-bold text-primary">{fmt(cmpCarsKm)} كم</div>
                <div className="text-xs text-muted-foreground mt-1">مجموع الطلبات: {fmt(cmpCarsTripsKm)} كم</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">إجمالي مسافة السائقين من الطلبات</div>
                <div className="text-xl font-bold text-primary">{fmt(cmpDriversKm)} كم</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">كم غير منسوب لسائق</div>
                <div className="text-xl font-bold text-destructive">{fmt(cmpUnassignedKm)} كم</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">الفرق</div>
                <div className={`text-xl font-bold ${totalDiffKm > 0 ? "text-destructive" : "text-muted-foreground"}`}>{fmt(totalDiffKm)} كم</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                مقارنة السيارات والسائقين — سيارات (عدّاد): {fmt(cmpCarsKm)} كم / سائقون (طلبات): {fmt(cmpDriversKm)} كم / الفرق: {fmt(totalDiffKm)} كم

              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportToXlsx(
                    "car-driver-comparison",
                    compareFiltered.map((r: any) => ({
                      "رقم اللوحة": r.car_plate,
                      "كود السيارة": r.car_code ?? "",
                      "الوصف": r.car_description ?? "",
                      "عدد الرحلات": r.trips_count,
                      "أول عداد": Math.round(r.min_start ?? 0),
                      "آخر عداد": Math.round(r.max_end ?? 0),
                      "مسافة السيارة (عدّاد) كم": Math.round(r.car_span_km ?? 0),
                      "مسافة السيارة (مجموع الطلبات) كم": Math.round(r.car_total_km),
                      "مسافة السائقين (كم)": Math.round(r.drivers_total_km),
                      "الفرق (كم)": Math.round(r.diff_km),
                      "عدد السائقين": r.drivers_count,
                      "أكثر سائق": r.top_driver ?? "",
                      "كم أكثر سائق": Math.round(r.top_driver_km),
                      "كم غير منسوب": Math.round(r.unassigned_km ?? 0),
                      "رحلات غير منسوبة": r.unassigned_trips ?? 0,
                      "تفصيل مسافة كل سائق": (r.driver_breakdown ?? [])
                        .map((d: any) => `${d.name}: ${fmt(d.km)} كم (${d.trips} رحلة)`)
                        .join(" — "),

                    })),
                  )
                }
              >
                <Download className="size-4 ml-1" /> Excel
              </Button>
            </CardHeader>
            <CardContent>
              {compare.isLoading ? (
                <Loader2 className="size-6 animate-spin mx-auto text-primary" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-right border-b">
                      <tr>
                        <th className="p-2">اللوحة</th>
                        <th className="p-2">الكود</th>
                        <th className="p-2">الوصف</th>
                        <th className="p-2">الرحلات</th>
                        <th className="p-2">أول عداد</th>
                        <th className="p-2">آخر عداد</th>
                        <th className="p-2">مسافة السيارة (عدّاد)</th>
                        <th className="p-2">مسافة السيارة (طلبات)</th>
                        <th className="p-2">مسافة السائقين</th>
                        <th className="p-2">الفرق</th>
                        <th className="p-2">عدد السائقين</th>
                        <th className="p-2">أكثر سائق</th>
                        <th className="p-2">مسافة كل سائق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareFiltered.map((r: any) => (
                        <tr key={r.car_plate} className="border-b hover:bg-muted/40">
                          <td className="p-2 font-semibold">{r.car_plate}</td>
                          <td className="p-2">{r.car_code ?? "-"}</td>
                          <td className="p-2">{r.car_description ?? "-"}</td>
                          <td className="p-2">{r.trips_count}</td>
                          <td className="p-2">{fmt(r.min_start ?? 0)}</td>
                          <td className="p-2">{fmt(r.max_end ?? 0)}</td>
                          <td className="p-2 font-bold text-primary">{fmt(r.car_span_km ?? 0)}</td>
                          <td className="p-2">{fmt(r.car_total_km)}</td>
                          <td className="p-2 font-bold">{fmt(r.drivers_total_km)}</td>
                          <td className={`p-2 font-bold ${r.diff_km !== 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {fmt(r.diff_km)}
                          </td>

                          <td className="p-2">{r.drivers_count}</td>
                          <td className="p-2">
                            {r.top_driver ? `${r.top_driver} (${fmt(r.top_driver_km)} كم)` : "-"}
                          </td>
                          <td className="p-2">
                            {(r.driver_breakdown ?? []).length > 0 || (r.unassigned_km ?? 0) > 0 ? (
                              <ul className="space-y-1">
                                {(r.driver_breakdown as any[] ?? []).map((d: any) => (
                                  <li key={d.name} className="text-xs">
                                    {d.name}: <span className="font-semibold">{fmt(d.km)} كم</span>{" "}
                                    <span className="text-muted-foreground">({d.trips} رحلة)</span>
                                  </li>
                                ))}
                                {(r.unassigned_km ?? 0) > 0 && (
                                  <li className="text-xs text-destructive">
                                    غير منسوب لسائق: <span className="font-semibold">{fmt(r.unassigned_km)} كم</span>{" "}
                                    ({r.unassigned_trips} رحلة)
                                  </li>
                                )}
                              </ul>
                            ) : (
                              "-"
                            )}
                          </td>

                        </tr>
                      ))}
                      {compareFiltered.length === 0 && (
                        <tr><td colSpan={10} className="text-center p-4 text-muted-foreground">لا توجد بيانات</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
