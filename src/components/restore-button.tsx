import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { restoreBackup } from "@/lib/backup.functions";
import { arabicError } from "@/lib/errors";

export function RestoreButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const restore = useServerFn(restoreBackup);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("سيتم استعادة البيانات من الملف. قد يستبدل هذا بيانات موجودة. هل تريد المتابعة؟")) return;
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // strip meta and keep only known tables
      const data: Record<string, any[]> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (k.startsWith("__")) continue;
        if (Array.isArray(v)) data[k] = v as any[];
      }
      const res = await restore({ data: { data } });
      const lines = Object.entries(res.report)
        .filter(([, r]: any) => r.inserted || r.skipped)
        .map(([t, r]: any) => `${t}: ${r.inserted} ✓${r.skipped ? ` / ${r.skipped} ✗` : ""}`)
        .join("\n");
      toast.success("تمت الاستعادة\n" + lines, { duration: 10000 });
    } catch (e: any) {
      toast.error(arabicError(e) ?? "فشل استعادة النسخة الاحتياطية");
    } finally {
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
        استعادة نسخة
      </Button>
    </>
  );
}
