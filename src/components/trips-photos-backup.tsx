import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSignedPhotoUrl } from "@/lib/storage";
import { arabicError } from "@/lib/errors";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

// تنسيق ثابت: يوم/شهر/سنة ساعة:دقيقة — مستقل عن إعدادات الجهاز
function fmtDate(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TripsPhotosBackup() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  async function run() {
    setLoading(true);
    setProgress("جاري تحميل البيانات…");
    try {
      const fromISO = new Date(`${from}T00:00:00`).toISOString();
      const toISO = new Date(`${to}T23:59:59.999`).toISOString();

      // 1) trips in range
      const trips: any[] = [];
      const PAGE = 1000;
      for (let start = 0; ; start += PAGE) {
        const { data, error } = await supabase
          .from("trips")
          .select("*")
          .gte("start_at", fromISO)
          .lte("start_at", toISO)
          .order("trip_no", { ascending: true })
          .range(start, start + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        trips.push(...data);
        if (data.length < PAGE) break;
      }

      if (trips.length === 0) {
        toast.error("لا توجد رحلات في هذه الفترة");
        return;
      }

      // 2) segments for those trips
      const ids = trips.map((t) => t.id);
      const segments: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from("trip_segments")
          .select("*")
          .in("trip_id", ids.slice(i, i + 200));
        if (error) throw error;
        segments.push(...(data ?? []));
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file(
        "trips.json",
        JSON.stringify(
          { __meta: { created_at: new Date().toISOString(), from, to, version: 1 }, trips, trip_segments: segments },
          null,
          2,
        ),
      );

      // 3) Excel sheet
      const XLSX = await import("xlsx");
      const rows = trips.map((t) => ({
        "رقم الطلب": t.trip_no,
        "التاريخ": fmtDate(t.start_at),
        "تاريخ الإنهاء": fmtDate(t.end_at),
        "كود السيارة": t.car_code ?? "",
        "رقم اللوحة": t.car_plate ?? "",
        "السائق": t.driver_name ?? "",
        "رقم ساب السائق": t.driver_sap ?? "",
        "بداية خط السير": t.route_start ?? "",
        "بداية العداد": t.start_odometer ?? "",
        "نهاية العداد": t.end_odometer ?? "",
        "الكيلومترات": t.end_odometer != null && t.start_odometer != null ? t.end_odometer - t.start_odometer : "",
        "المحافظة": t.governorate_name ?? "",
        "رقم أمر ساب": t.sap_order_no ?? "",
        "الحالة": t.status,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "trips");
      const xlsxBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      zip.file("trips.xlsx", xlsxBuf);

      // 4) photos
      const jobs: Array<{ trip_no: number; name: string; path: string }> = [];
      const segByTrip = new Map<string, any[]>();
      for (const s of segments) {
        const arr = segByTrip.get(s.trip_id) ?? [];
        arr.push(s);
        segByTrip.set(s.trip_id, arr);
      }
      for (const t of trips) {
        if (t.start_photo_url) jobs.push({ trip_no: t.trip_no, name: "start", path: t.start_photo_url });
        if (t.end_photo_url) jobs.push({ trip_no: t.trip_no, name: "end", path: t.end_photo_url });
        for (const s of (segByTrip.get(t.id) ?? []).sort((a, b) => a.sequence - b.sequence)) {
          if (s.photo_url) jobs.push({ trip_no: t.trip_no, name: `segment-${s.sequence}`, path: s.photo_url });
        }
      }

      let done = 0;
      let failed = 0;
      const CONCURRENCY = 5;
      async function worker(queue: typeof jobs) {
        while (queue.length) {
          const job = queue.shift();
          if (!job) return;
          try {
            const url = await getSignedPhotoUrl(job.path);
            const res = await fetch(url);
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            const ext = (job.path.split(".").pop() || "jpg").split("?")[0];
            zip.file(`photos/${job.trip_no}/${job.name}.${ext}`, blob);
          } catch {
            failed++;
          }
          done++;
          setProgress(`الصور: ${done} / ${jobs.length}`);
        }
      }
      const queue = [...jobs];
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

      setProgress("جاري ضغط الملف…");
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trips-backup-${from}_${to}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(
        `تم إنشاء النسخة: ${trips.length} رحلة و ${jobs.length - failed} صورة${failed ? ` (تعذّر ${failed} صورة)` : ""}`,
        { duration: 8000 },
      );
      setOpen(false);
    } catch (e: any) {
      toast.error("فشل إنشاء النسخة الاحتياطية بالصور: " + arabicError(e));
    } finally {
      setProgress("");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileArchive className="size-4" />
          نسخة الرحلات بالصور
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>نسخة احتياطية للرحلات بالصور</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1">
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={loading} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          يتم تنزيل ملف ZIP يحتوي على بيانات الرحلات (JSON و Excel) وكل صور العدادات مرتبة حسب رقم الطلب. اختر فترة قصيرة
          إذا كانت الشبكة ضعيفة.
        </p>
        <DialogFooter className="gap-2">
          {progress && <span className="text-xs text-muted-foreground self-center">{progress}</span>}
          <Button onClick={run} disabled={loading || !from || !to} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
            تنزيل النسخة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
