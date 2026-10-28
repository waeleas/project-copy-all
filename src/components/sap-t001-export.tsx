import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { sapOperationText } from "@/lib/sap-operation-text";

const FILE_NAME = "IW31-Creat_Employee_Trip_Order-T001.xlsx";

const HEADERS = [
  "Order Type",
  "Equipment",
  "Order Description",
  "Planner Grp",
  "Mn.wk.ctr",
  "Person Respons",
  "PMActType",
  "Bsc Start",
  "Basic Fin.",
  "Operation Short Text",
  "Mn.wk.ctr/Plnt",
  "Acty Type",
  "Work durtn",
  "Unit for work",
  "Number",
  "duration/unit",
  "Sort Field",
];

const WIDTHS = [6.7, 10.3, 20.9, 7.7, 9.9, 9.6, 13, 9.9, 13, 21.9, 10.9, 9, 6.9, 7.4, 7.9, 9, 11.4];

const SHEETS = [
  { name: "T001", headers: HEADERS, widths: WIDTHS },
  {
    name: "تجهيز",
    headers: [
      "Order Type",
      "Equipment",
      "Order Description",
      "Planner Grp",
      "Mn.wk.ctr\nالمسئول",
      "Person Respons\nساب الطالب",
      "PMActType",
      "Bsc Start",
      "Basic Fin.",
      "Operation Short Text",
      "Mn.wk.ctr/Plnt\nالسائق",
      "Acty Type",
      "Work durtn",
      "Unit for work",
      "Number",
      "duration/unit",
      "Sort Field\nرقم الطلب",
    ],
    widths: [6.7, 10.3, 20.9, 7.7, 14.4, 18.7, 9.6, 9.9, 13, 19.4, 10.9, 9, 13, 13, 7.9, 9, 11.4],
  },
];

function sapDate(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

async function buildRows(trips: any[]) {
  const { data: carsMaster } = await supabase.from("cars" as any).select("plate, code, acty_type");
  const byPlate = new Map<string, string>();
  const byCode = new Map<string, string>();
  ((carsMaster as any[]) ?? []).forEach((c: any) => {
    if (c.plate) byPlate.set(String(c.plate).trim(), c.acty_type ?? "");
    if (c.code) byCode.set(String(c.code).trim(), c.acty_type ?? "");
  });

  const ids = trips.map((t) => t.id);
  const segsAll: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("trip_segments" as any)
      .select("trip_id, route, sequence")
      .in("trip_id", ids.slice(i, i + 100));
    segsAll.push(...((data as any[]) ?? []));
  }
  const segsByTrip: Record<string, any[]> = {};
  segsAll
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .forEach((s) => {
      (segsByTrip[s.trip_id] ||= []).push(s);
    });

  return trips.map((t) => {
    const segs = segsByTrip[t.id] ?? [];
    const extraRoutes = segs.map((s) => String(s.route ?? "").trim()).filter(Boolean);
    const operationShortText = sapOperationText(t.route_start, extraRoutes);
    const km = t.end_odometer != null && t.start_odometer != null ? t.end_odometer - t.start_odometer : "";
    const pmActType = t.service_type?.pmact_type ?? "";
    const driverSap = t.driver?.sap_number ?? t.driver_sap ?? "";
    let personRespons = t.technician?.sap_number ?? "";
    const hasArabicLetters = /[\u0600-\u06FF]/.test(String(personRespons));
    if (!String(personRespons).trim() || hasArabicLetters) {
      personRespons = driverSap;
    }
    return [
      "T001", // Order Type
      t.car_code ?? "", // Equipment
      t.governorate_name ?? "", // Order Description
      "FP1", // Planner Grp
      "50004669", // Mn.wk.ctr
      personRespons, // Person Respons
      pmActType, // PMActType
      sapDate(t.start_at), // Bsc Start
      sapDate(t.end_at ?? t.start_at), // Basic Fin.
      operationShortText, // Operation Short Text
      t.driver?.sap_number ?? t.driver_sap ?? "", // Mn.wk.ctr/Plnt
      byPlate.get(String(t.car_plate ?? "").trim()) || byCode.get(String(t.car_code ?? "").trim()) || "", // Acty Type
      km, // Work durtn
      "TKM", // Unit for work
      1, // Number
      "TKM", // duration/unit
      t.trip_no ?? "", // Sort Field
    ];
  });
}

async function downloadTemplate(trips: any[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "خطوط السير";
  wb.created = new Date();

  const dataRows = trips.length ? await buildRows(trips) : [];

  for (const s of SHEETS) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
    const row = ws.getRow(1);
    s.headers.forEach((h, i) => {
      const c = row.getCell(i + 1);
      c.value = h;
      c.font = { name: "Calibri", size: 11, bold: true };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      ws.getColumn(i + 1).width = s.widths[i];
    });
    row.height = 30;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.headers.length } };

    if (s.name === "T001") {
      dataRows.forEach((r) => {
        const added = ws.addRow(r);
        added.eachCell((c) => {
          c.font = { name: "Calibri", size: 11 };
          c.alignment = { horizontal: "center", vertical: "middle" };
        });
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success(dataRows.length ? `تم تنزيل شيت SAP (${dataRows.length} طلب)` : "تم تنزيل الشيت الفارغ");
}

export function SapT001Export({ getTrips }: { getTrips: () => Promise<any[]> }) {
  const { isAdmin } = useIsAdmin();
  if (!isAdmin) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => downloadTemplate((await getTrips()).filter((t) => !t.sap_order_no))}
      className="gap-1"
    >
      <FileSpreadsheet className="size-4" /> SAP T001
    </Button>
  );
}

