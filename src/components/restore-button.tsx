import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { restoreChunk, TABLE_ORDER } from "@/lib/backup.functions";
import { arabicError } from "@/lib/errors";

const CHUNK = 200;
const TABLE_LABELS: Record<string, string> = {
  app_settings: "الإعدادات", offices: "المكاتب", managers: "المديرون", technicians: "الفنيون",
  drivers: "السائقون", cars: "السيارات", service_types: "أنواع الخدمة", profiles: "المستخدمون",
  user_roles: "الصلاحيات", trips: "الرحلات", trip_segments: "المسارات الإضافية",
  governorates: "المحافظات",
};

export function RestoreButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const restore = useServerFn(restoreChunk);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("سيتم استعادة البيانات من الملف. قد يستبدل هذا بيانات موجودة. هل تريد المتابعة؟")) return;
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const data: Record<string, any[]> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (k.startsWith("__")) continue;
        if (Array.isArray(v)) data[k] = v as any[];
      }

      const total = TABLE_ORDER.reduce((s, t) => s + (data[t]?.length ?? 0), 0);
      let done = 0;
      const report: Record<string, { inserted: number; skipped: number }> = {};

      for (const table of TABLE_ORDER) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        report[table] = { inserted: 0, skipped: 0 };

        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          let attempt = 0;
          // retry transient network/timeouts
          while (true) {
            try {
              const res = await restore({ data: { table, rows: chunk } });
              report[table].inserted += res.inserted;
              report[table].skipped += res.skipped;
              break;
            } catch (err) {
              attempt++;
              if (attempt >= 3) throw err;
              await new Promise((r) => setTimeout(r, 800 * attempt));
            }
          }
          done += chunk.length;
          setProgress(`${Math.round((done / Math.max(total, 1)) * 100)}%`);
        }
      }

      const lines = Object.entries(report)
        .map(([t, r]) => `${TABLE_LABELS[t] ?? "بيانات"}: استعادة ${r.inserted}${r.skipped ? ` / تعذرت استعادة ${r.skipped} سجل` : ""}`)
        .join("\n");
      const partial = Object.values(report).some(r => r.skipped > 0);
      if (partial) toast.warning("اكتملت الاستعادة جزئيًا؛ بعض السجلات لم تُحفظ، ولا يتوفر سبب تفصيلي لها\n" + lines, { duration: 10000 });
      else toast.success("تمت الاستعادة\n" + lines, { duration: 10000 });
    } catch (e: any) {
      toast.error(arabicError(e) ?? "فشل استعادة النسخة الاحتياطية");
    } finally {
      setProgress(null);
      setLoading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        variant="outline"
        className="gap-2"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {loading ? `استعادة… ${progress ?? ""}` : "استعادة نسخة"}
      </Button>
    </>
  );
}
