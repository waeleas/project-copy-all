import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { arabicError } from "@/lib/errors";

const AR_DIGITS = /[٠-٩]/g;
function toEnDigits(s: string) {
  return String(s ?? "").replace(AR_DIGITS, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function pick(row: any, keys: string[]) {
  for (const k of Object.keys(row)) {
    const norm = String(k).toLowerCase();
    if (keys.some((key) => norm.includes(key))) {
      const v = toEnDigits(String(row[k] ?? "")).trim();
      if (v) return v;
    }
  }
  return "";
}

export function SapOrdersImport({ onDone }: { onDone?: () => void }) {
  const { isAdmin } = useIsAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("الملف لا يحتوي على ورقة بيانات قابلة للقراءة");
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      const pairs: { trip_no: number; order: string }[] = [];
      for (const r of rows) {
        const tripNo = Number(pick(r, ["sort field", "رقم الطلب", "trip"]));
        const order = pick(r, ["order"]);
        if (!tripNo || !order) continue;
        pairs.push({ trip_no: tripNo, order });
      }
      if (!pairs.length) {
        toast.error("لم يتم العثور على أعمدة (Sort Field / Order) في الملف");
        return;
      }

      const stamp = new Date().toISOString();
      let ok = 0;
      let failed = 0;
      const reasons = new Set<string>();
      for (const p of pairs) {
        const { data, error } = await supabase
          .from("trips" as any)
          .update({ sap_order_no: p.order, sap_uploaded_at: stamp } as any)
          .eq("trip_no", p.trip_no)
          .select("id");
        if (error || !data || data.length === 0) {
          failed++;
          reasons.add(error ? arabicError(error) : "لم يتم تحديث الطلب؛ قد يكون رقم الطلب غير موجود أو غير متاح لحسابك");
        }
        else ok++;
      }

      const message = `تم حفظ أرقام أوامر الساب لـ ${ok} طلب${failed ? `؛ تعذر حفظ ${failed} طلب: ${[...reasons].join("؛ ")}` : ""}`;
      if (failed) toast.warning(message, { duration: 10000 });
      else toast.success(message);
      onDone?.();
    } catch (err: any) {
      toast.error("تعذر استيراد أرقام أوامر الساب: " + arabicError(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="gap-1"
      >
        <Upload className="size-4" /> {busy ? "جارٍ الرفع..." : "رفع أرقام أوامر الساب"}
      </Button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
    </>
  );
}
