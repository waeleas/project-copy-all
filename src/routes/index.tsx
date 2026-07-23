import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Clock, CheckCircle2, Car, Gauge, Timer, Download, Search, X } from "lucide-react";
import { formatDuration, tripDurationMs } from "@/lib/duration";

import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "خطوط السير للسيارات" }] }),
  component: () => <AppShell><TripsList /></AppShell>,
});

function TripsList() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const [tripNoQ, setTripNoQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "completed">("all");
  const [serviceFilter, setServiceFilter] = useState<"all" | "worker" | "aftersales">("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(`
          *,
          office:offices!trips_office_id_fkey(name),
          follow_office:offices!trips_follow_office_id_fkey(name),
          manager:managers(name),
          technician:technicians(name, sap_number),
          driver:drivers(name, sap_number),
          service_type:service_types(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!trips) return [];
    return trips.filter((t: any) => {
      if (statusFilter === "open" && t.status !== "open") return false;
      if (statusFilter === "completed" && t.status === "open") return false;
      const svc = t.service_type?.name ?? "";
      const isWorker = svc.includes("نقل") && svc.includes("عامل");
      if (serviceFilter === "worker" && !isWorker) return false;
      if (serviceFilter === "aftersales" && isWorker) return false;
      if (tripNoQ.trim()) {
        const q = tripNoQ.trim().toLowerCase();
        const hay = [
          t.trip_no, t.car_code, t.car_plate, t.car_description,
          t.route_start, t.notes,
          t.office?.name, t.follow_office?.name, t.manager?.name,
          t.service_type?.name,
          t.technician?.name, t.technician?.sap_number,
          t.driver?.name, t.driver?.sap_number, t.driver_name_rental,
          t.created_by_name, t.created_by_email,
        ].map((v) => String(v ?? "").toLowerCase()).join(" | ");
        if (!hay.includes(q)) return false;
      }
      if (dateFrom) {
        if (new Date(t.start_at) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(t.start_at) > end) return false;
      }
      return true;
    }).sort((a: any, b: any) => {
      const da = new Date(a.start_at ?? a.created_at).getTime();
      const db = new Date(b.start_at ?? b.created_at).getTime();
      return db - da;
    });
  }, [trips, tripNoQ, dateFrom, dateTo, statusFilter, serviceFilter]);

  useEffect(() => { setPage(1); }, [tripNoQ, dateFrom, dateTo, statusFilter, serviceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);


  const counts = useMemo(() => {
    const all = trips?.length ?? 0;
    const open = trips?.filter((t: any) => t.status === "open").length ?? 0;
    return { all, open, completed: all - open };
  }, [trips]);

  function clearFilters() {
    setTripNoQ(""); setDateFrom(""); setDateTo(""); setStatusFilter("all"); setServiceFilter("all");
  }

  async function exportExcel() {
    if (!filtered || filtered.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const ids = filtered.map((t: any) => t.id);
    const { data: segs } = await supabase
      .from("trip_segments" as any)
      .select("*")
      .in("trip_id", ids)
      .order("sequence", { ascending: true });
    const segsByTrip: Record<string, any[]> = {};
    (segs as any[] | null)?.forEach((s) => {
      (segsByTrip[s.trip_id] ||= []).push(s);
    });

    type Row = Record<string, any> & { __kind: "start" | "seg" | "end" };
    const rows: Row[] = [];
    filtered.forEach((t: any) => {
      const durMs = tripDurationMs(t, Date.now());
      const totalMin = Math.floor(durMs / 60000);
      const distance = t.end_odometer != null ? t.end_odometer - t.start_odometer : null;
      const tSegs = segsByTrip[t.id] ?? [];

      const baseRow: any = {
        "رقم الطلب": t.trip_no ?? "",
        "نوع المسار": "بداية الرحلة",
        "ترتيب المسار": 0,
        "نوع السيارة": t.car_type === "rental" ? "إيجار" : "شركة",
        "الحالة": t.status === "open" ? "مفتوحة" : "مكتملة",
        "المكتب": t.office?.name ?? "",
        "نوع الخدمة": t.service_type?.name ?? "",
        "المدير المسؤول": t.manager?.name ?? "",
        "اسم متلقي الخدمة أو فنى": t.technician?.name ?? "",
        "كود ساب متلقي الخدمة أو فنى": t.technician?.sap_number ?? "",
        "اسم السائق": t.driver?.name ?? t.driver_name_rental ?? "",
        "كود ساب السائق": t.driver?.sap_number ?? "",
        "كود السيارة": t.car_code ?? "",
        "رقم لوحة السيارة": t.car_plate ?? "",
        "وصف السيارة": t.car_description ?? "",
        "خط السير": t.route_start ?? "",
        "قراءة العداد (كم)": t.start_odometer,
        "وقت التسجيل": new Date(t.start_at).toLocaleString("ar-EG"),
        "عداد النهاية (كم)": "",
        "المسافة الكلية (كم)": "",
        "وقت النهاية": "",
        "المدة (دقائق)": "",
        "المدة": "",
        "منشئ الطلب": t.created_by_name ?? t.created_by_email ?? "",
        "ملاحظات": "",
        "تم الإنشاء": new Date(t.created_at).toLocaleString("ar-EG"),
      };
      rows.push({ ...baseRow, __kind: "start" });

      tSegs.forEach((s, i) => {
        rows.push({
          ...baseRow,
          "نوع المسار": `مسار إضافي #${i + 1}`,
          "ترتيب المسار": i + 1,
          "خط السير": s.route ?? "",
          "قراءة العداد (كم)": "",
          "وقت التسجيل": new Date(s.created_at).toLocaleString("ar-EG"),
          "تم الإنشاء": "",
          __kind: "seg",
        });
      });

      if (t.end_odometer != null) {
        rows.push({
          ...baseRow,
          "نوع المسار": "نهاية الرحلة",
          "ترتيب المسار": tSegs.length + 1,
          "قراءة العداد (كم)": t.end_odometer,
          "وقت التسجيل": t.end_at ? new Date(t.end_at).toLocaleString("ar-EG") : "",
          "عداد النهاية (كم)": t.end_odometer,
          "المسافة الكلية (كم)": distance ?? "",
          "وقت النهاية": t.end_at ? new Date(t.end_at).toLocaleString("ar-EG") : "",
          "المدة (دقائق)": totalMin,
          "المدة": formatDuration(durMs),
          "ملاحظات": t.notes ?? "",
          "تم الإنشاء": "",
          __kind: "end",
        });
      }
    });

    if (rows.length === 0) return toast.error("لا توجد بيانات للتصدير");

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "خطوط السير";
    wb.created = new Date();
    const ws = wb.addWorksheet("الرحلات", {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }],
      properties: { defaultRowHeight: 20 },
    });

    const headers = Object.keys(rows[0]).filter((k) => k !== "__kind");

    // Title row
    ws.mergeCells(1, 1, 1, headers.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `تقرير الرحلات — ${new Date().toLocaleString("ar-EG")}`;
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    ws.getRow(1).height = 32;

    // Summary row
    ws.mergeCells(2, 1, 2, headers.length);
    const openCount = filtered.filter((t: any) => t.status === "open").length;
    const doneCount = filtered.length - openCount;
    const summary = ws.getCell(2, 1);
    summary.value = `إجمالي الرحلات: ${filtered.length}   |   المفتوحة: ${openCount}   |   المكتملة: ${doneCount}`;
    summary.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E3A8A" } };
    summary.alignment = { horizontal: "center", vertical: "middle" };
    summary.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    ws.getRow(2).height = 22;

    // Header row
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = {
        top: { style: "thin", color: { argb: "FF1E3A8A" } },
        bottom: { style: "medium", color: { argb: "FF1E3A8A" } },
        left: { style: "thin", color: { argb: "FF1E3A8A" } },
        right: { style: "thin", color: { argb: "FF1E3A8A" } },
      };
    });
    headerRow.height = 34;

    // Data rows
    rows.forEach((r, idx) => {
      const excelRow = ws.getRow(idx + 4);
      const isEnd = r.__kind === "end";
      const isSeg = r.__kind === "seg";
      const status = r["الحالة"];
      const zebra = idx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF";
      const kindFill = isEnd ? "FFDCFCE7" : isSeg ? "FFFEF3C7" : zebra;

      headers.forEach((h, i) => {
        const cell = excelRow.getCell(i + 1);
        cell.value = r[h] === "" || r[h] == null ? null : r[h];
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kindFill } };
        cell.border = {
          top: { style: "hair", color: { argb: "FFCBD5E1" } },
          bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
          left: { style: "hair", color: { argb: "FFCBD5E1" } },
          right: { style: "hair", color: { argb: "FFCBD5E1" } },
        };

        if (h === "الحالة") {
          const isOpen = status === "مفتوحة";
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isOpen ? "FF92400E" : "FF166534" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isOpen ? "FFFEF3C7" : "FFDCFCE7" } };
        }
        if (h === "رقم الطلب") {
          cell.font = { name: "Consolas", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
        }
        if (h === "نوع المسار") {
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isEnd ? "FF166534" : isSeg ? "FF92400E" : "FF1E3A8A" } };
        }
        if (typeof r[h] === "number") {
          cell.numFmt = "#,##0";
        }
      });
      excelRow.height = 22;
    });

    // Column widths
    const widths: Record<string, number> = {
      "رقم الطلب": 12,
      "نوع المسار": 16,
      "ترتيب المسار": 10,
      "نوع السيارة": 12,
      "الحالة": 12,
      "المكتب": 18,
      "نوع الخدمة": 18,
      "المدير المسؤول": 20,
      "اسم متلقي الخدمة أو فنى": 24,
      "كود ساب متلقي الخدمة أو فنى": 16,
      "اسم السائق": 22,
      "كود ساب السائق": 14,
      "كود السيارة": 12,
      "رقم لوحة السيارة": 16,
      "وصف السيارة": 22,
      "خط السير": 30,
      "قراءة العداد (كم)": 14,
      "وقت التسجيل": 22,
      "عداد النهاية (كم)": 14,
      "المسافة الكلية (كم)": 14,
      "وقت النهاية": 22,
      "المدة (دقائق)": 12,
      "المدة": 14,
      "منشئ الطلب": 22,
      "ملاحظات": 28,
      "تم الإنشاء": 22,
    };
    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = widths[h] ?? 18;
    });

    // AutoFilter on header row
    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: headers.length },
    };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `trips-${stamp}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الملف");
  }



  const hasFilters = !!(tripNoQ || dateFrom || dateTo || statusFilter !== "all" || serviceFilter !== "all");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">الرحلات</h1>
          <p className="text-sm text-muted-foreground">جميع رحلات خدمة ما بعد البيع</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}><Download className="size-4 ml-1" /> Excel</Button>
          <Link to="/trips/new">
            <Button><Plus className="size-4 ml-1" /> رحلة جديدة</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              الكل <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "open" ? "default" : "outline"}
              onClick={() => setStatusFilter("open")}
              className={statusFilter === "open" ? "bg-warning text-warning-foreground hover:bg-warning/90" : ""}
            >
              <Clock className="size-3 ml-1" /> المفتوحة <Badge variant="secondary" className="ml-1">{counts.open}</Badge>
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "completed" ? "default" : "outline"}
              onClick={() => setStatusFilter("completed")}
              className={statusFilter === "completed" ? "bg-success text-success-foreground hover:bg-success/90" : ""}
            >
              <CheckCircle2 className="size-3 ml-1" /> المكتملة <Badge variant="secondary" className="ml-1">{counts.completed}</Badge>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={serviceFilter === "all" ? "default" : "outline"} onClick={() => setServiceFilter("all")}>كل الخدمات</Button>
            <Button size="sm" variant={serviceFilter === "worker" ? "default" : "outline"} onClick={() => setServiceFilter("worker")}>نقل عاملين</Button>
            <Button size="sm" variant={serviceFilter === "aftersales" ? "default" : "outline"} onClick={() => setServiceFilter("aftersales")}>خدمة ما بعد البيع</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Search className="size-3" /> بحث</Label>
              <Input value={tripNoQ} onChange={(e) => setTripNoQ(e.target.value)} placeholder="ابحث برقم الطلب، اسم، كود، لوحة، مسار..." />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">من تاريخ</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} dir="ltr" />
            </div>
          </div>
          {hasFilters && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>عرض {filtered.length} من {trips?.length ?? 0}</span>
              <Button size="sm" variant="ghost" onClick={clearFilters}><X className="size-3 ml-1" /> مسح الفلاتر</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>}

      {!isLoading && trips && trips.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto size-14 rounded-2xl bg-muted flex items-center justify-center">
              <Car className="size-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">لا توجد رحلات بعد</p>
            <Link to="/trips/new">
              <Button>ابدأ أول رحلة</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {pageItems.map((t: any) => (
          <Link key={t.id} to="/trips/$id" params={{ id: t.id }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">#{t.trip_no}</Badge>
                      <span className="text-xs text-muted-foreground">{t.car_type === "rental" ? "إيجار" : "شركة"}</span>
                    </div>
                    <div className="font-bold mt-1">{t.service_type?.name ?? "بدون نوع"}</div>
                    <div className="text-sm text-muted-foreground">{t.office?.name ?? (t.car_type === "company" ? "سيارة شركة" : "—")}</div>
                  </div>
                  {t.status === "open" ? (
                    <Badge className="bg-warning text-warning-foreground"><Clock className="size-3 ml-1" /> مفتوحة</Badge>
                  ) : (
                    <Badge className="bg-success text-success-foreground"><CheckCircle2 className="size-3 ml-1" /> مكتملة</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">السائق: </span>{t.driver?.name ?? t.driver_name_rental ?? "—"}</div>
                  <div><span className="text-muted-foreground">متلقي الخدمة أو فنى: </span>{t.technician?.name ?? "—"}</div>
                  <div className="flex items-center gap-1"><Gauge className="size-4 text-muted-foreground" /> بداية: <b>{t.start_odometer}</b></div>
                  {t.end_odometer != null && (
                    <div className="flex items-center gap-1"><Gauge className="size-4 text-success" /> نهاية: <b>{t.end_odometer}</b></div>
                  )}
                  {t.end_odometer != null && (
                    <div className="flex items-center gap-1 col-span-2 bg-success/10 rounded-md px-2 py-1">
                      <Gauge className="size-4 text-success" />
                      <span className="text-muted-foreground">فرق الكيلومتر:</span>
                      <b className="text-success">{t.end_odometer - t.start_odometer} كم</b>
                    </div>
                  )}
                  <div className="flex items-center gap-1 col-span-2">
                    <Timer className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t.status === "open" ? "المدة حتى الآن:" : "المدة:"}</span>
                    <b>{formatDuration(tripDurationMs(t, now))}</b>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>{new Date(t.start_at).toLocaleString("ar-EG")}</span>
                  {(t.created_by_name ?? t.created_by_email) && <span>بواسطة: {t.created_by_name ?? t.created_by_email}</span>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
