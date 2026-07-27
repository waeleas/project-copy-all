import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { arabicError } from "@/lib/errors";

const TABLES = [
  "app_settings",
  "offices",
  "managers",
  "technicians",
  "drivers",
  "cars",
  "service_types",
  "profiles",
  "user_roles",
  "trips",
  "trip_segments",
] as const;

export function BackupButton() {
  const [loading, setLoading] = useState(false);

  async function runBackup() {
    setLoading(true);
    try {
      const backup: Record<string, unknown> = {
        __meta: {
          created_at: new Date().toISOString(),
          version: 1,
        },
      };

      for (const t of TABLES) {
        const all: any[] = [];
        const PAGE = 1000;
        let from = 0;
        // paginate
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from(t as any)
            .select("*")
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        backup[t] = all;
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("تم إنشاء النسخة الاحتياطية");
    } catch (e: any) {
      toast.error(arabicError(e) ?? "فشل إنشاء النسخة الاحتياطية");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={runBackup} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      نسخة احتياطية
    </Button>
  );
}
