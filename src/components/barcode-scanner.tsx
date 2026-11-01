import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { arabicError } from "@/lib/errors";

interface Props {
  onScan: (text: string) => void;
}

export function BarcodeScanner({ onScan }: Props) {
  const [open, setOpen] = useState(false);
  const containerId = "barcode-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const start = async () => {
      // wait for dialog DOM
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;
      const el = document.getElementById(containerId);
      if (!el) {
        toast.error("لم يتم تجهيز عنصر الكاميرا");
        setOpen(false);
        return;
      }
      try {
        const html5 = new Html5Qrcode(containerId, { verbose: false } as any);
        scannerRef.current = html5;
        try {
          await html5.start(
            { facingMode: { exact: "environment" } },
            { fps: 10, qrbox: { width: 260, height: 160 } },
            (decodedText) => {
              if (cancelled) return;
              onScan(decodedText);
              toast.success("تم قراءة الباركود");
              setOpen(false);
            },
            () => {}
          );
        } catch {
          // fallback: any camera
          await html5.start(
            { facingMode: "environment" } as any,
            { fps: 10, qrbox: { width: 260, height: 160 } },
            (decodedText) => {
              if (cancelled) return;
              onScan(decodedText);
              toast.success("تم قراءة الباركود");
              setOpen(false);
            },
            () => {}
          );
        }
      } catch (e: any) {
        toast.error(arabicError(e, "تعذر فتح الكاميرا؛ لم يحدد الجهاز سببًا واضحًا"));
        console.error("Camera error:", e);
        setOpen(false);
      }
    };
    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan]);

  return (
    <>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)} title="مسح الباركود">
        <ScanLine className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>مسح باركود السيارة</DialogTitle>
          </DialogHeader>
          <div id={containerId} className="w-full rounded-md overflow-hidden bg-black" />
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            <X className="h-4 w-4 ml-1" /> إلغاء
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
