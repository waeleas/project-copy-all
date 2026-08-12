import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Upload, Search } from "lucide-react";
import * as XLSX from "xlsx";

type Props = {
  search: string;
  onSearch: (v: string) => void;
  onExport: () => void;
  onImportRows: (rows: any[]) => any;
  placeholder?: string;
};

export function DataToolbar({ search, onSearch, onExport, onImportRows, placeholder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
      // تخطي صفوف العنوان/الملخص: أول صف يحتوي على خليتين أو أكثر يعتبر رأس الجدول
      const headerIdx = matrix.findIndex(
        (r) => Array.isArray(r) && r.filter((c) => String(c ?? "").trim() !== "").length >= 2,
      );
      const rows =
        headerIdx <= 0
          ? XLSX.utils.sheet_to_json<any>(ws, { defval: "" })
          : XLSX.utils.sheet_to_json<any>(ws, { defval: "", range: headerIdx });
      await onImportRows(rows);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
      <div className="relative flex-1">
        <Search className="size-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder ?? "بحث..."}
          className="pr-8"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onExport} className="gap-1">
          <Download className="size-4" /> تصدير
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
          <Upload className="size-4" /> استيراد
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

/** تصدير منسّق واحترافي (عربي RTL) لأي جدول بيانات. */
export async function exportToXlsx(filename: string, rows: any[], title?: string) {
  if (!rows || rows.length === 0) return;
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "خطوط السير";
  wb.created = new Date();

  const name = filename.replace(/\.xlsx$/i, "");
  const ws = wb.addWorksheet("البيانات", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }],
    properties: { defaultRowHeight: 20 },
  });

  const headers = Object.keys(rows[0]);

  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${title ?? name} — ${new Date().toLocaleString("ar-EG")}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  ws.getRow(1).height = 32;

  ws.mergeCells(2, 1, 2, headers.length);
  const summary = ws.getCell(2, 1);
  summary.value = `عدد السجلات: ${rows.length}`;
  summary.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E3A8A" } };
  summary.alignment = { horizontal: "center", vertical: "middle" };
  summary.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  ws.getRow(2).height = 22;

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
  headerRow.height = 30;

  rows.forEach((r, idx) => {
    const row = ws.getRow(idx + 4);
    const zebra = idx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF";
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      const v = r[h];
      cell.value = v === "" || v == null ? null : v;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
      cell.border = {
        top: { style: "hair", color: { argb: "FFCBD5E1" } },
        bottom: { style: "hair", color: { argb: "FFCBD5E1" } },
        left: { style: "hair", color: { argb: "FFCBD5E1" } },
        right: { style: "hair", color: { argb: "FFCBD5E1" } },
      };
      if (typeof v === "number") cell.numFmt = "#,##0";
    });
    row.height = 20;
  });

  headers.forEach((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.slice(0, 300).map((r) => String(r[h] ?? "").length),
    );
    ws.getColumn(i + 1).width = Math.min(40, Math.max(12, maxLen + 4));
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: headers.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Find a value in a row by any of the candidate header names (case/space-insensitive). */
export function pick(row: any, ...keys: string[]): string {
  const norm = (s: string) => s.toString().trim().toLowerCase().replace(/\s+/g, "");
  const map: Record<string, any> = {};
  for (const k of Object.keys(row)) map[norm(k)] = row[k];
  for (const k of keys) {
    const v = map[norm(k)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
