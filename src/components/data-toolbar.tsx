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
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
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

export function exportToXlsx(filename: string, rows: any[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "data");
  XLSX.writeFile(wb, filename);
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
