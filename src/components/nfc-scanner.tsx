import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Nfc, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onScan: (text: string) => void;
}

// قارئ بطاقات NFC باستخدام Web NFC API (يعمل على Chrome Android فقط مع HTTPS)
export function NfcScanner({ onScan }: Props) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const supported = typeof window !== "undefined" && "NDEFReader" in window;

  useEffect(() => {
    if (!open) return;
    if (!supported) {
      toast.error("جهازك أو متصفحك لا يدعم NFC. استخدم Chrome على Android مع HTTPS");
      setOpen(false);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const start = async () => {
      try {
        // @ts-ignore - NDEFReader غير معرف فى TypeScript الافتراضى
        const ndef = new window.NDEFReader();
        await ndef.scan({ signal: ctrl.signal });
        setReading(true);
        ndef.onreadingerror = () => {
          toast.error("تعذر قراءة البطاقة، حاول مرة أخرى");
        };
        ndef.onreading = (event: any) => {
          if (cancelled) return;
          let text = "";
          // قراءة السيريال نمبر للبطاقة (UID)
          if (event.serialNumber) {
            text = String(event.serialNumber).replace(/:/g, "").toUpperCase();
          }
          // محاولة قراءة أى نص داخل البطاقة
          try {
            for (const rec of event.message?.records ?? []) {
              if (rec.recordType === "text") {
                const dec = new TextDecoder(rec.encoding || "utf-8");
                const t = dec.decode(rec.data).trim();
                if (t) { text = t; break; }
              } else if (rec.recordType === "url") {
                const dec = new TextDecoder();
                const t = dec.decode(rec.data).trim();
                if (t) { text = t; break; }
              }
            }
          } catch {}
          if (text) {
            onScan(text);
            toast.success("تم قراءة بطاقة NFC");
            setOpen(false);
          } else {
            toast.error("البطاقة فارغة");
          }
        };
      } catch (e: any) {
        const name = e?.name || "";
        const msg = e?.message || "";
        const inIframe = typeof window !== "undefined" && window.self !== window.top;
        let userMsg = "تعذر تشغيل NFC";
        if (/top-level browsing context/i.test(msg) || inIframe) {
          userMsg = "لا يمكن تشغيل NFC داخل نافذة المعاينة. افتح التطبيق فى نافذة المتصفح مباشرة على هاتف Android";
        } else if (name === "NotAllowedError") {
          userMsg = "تم رفض إذن NFC. فعّله من إعدادات المتصفح";
        } else if (name === "NotSupportedError") {
          userMsg = "الجهاز أو المتصفح لا يدعم NFC. استخدم Chrome على Android";
        } else if (name === "NotReadableError") {
          userMsg = "خاصية NFC غير مفعّلة. فعّلها من إعدادات الهاتف ثم حاول مجدداً";
        } else if (name === "SecurityError") {
          userMsg = "تم رفض الوصول إلى NFC لأسباب أمنية. تأكد من فتح الموقع عبر HTTPS وفى نافذة مستقلة";
        }
        toast.error(userMsg);
        setOpen(false);
      }
    };
    start();
    return () => {
      cancelled = true;
      setReading(false);
      try { ctrl.abort(); } catch {}
      abortRef.current = null;
    };
  }, [open, onScan, supported]);

  return (
    <>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)} title="قراءة بطاقة NFC">
        <Nfc className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>قراءة بطاقة NFC</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="relative">
              <Nfc className="size-16 text-primary" />
              {reading && (
                <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {reading
                ? "قرّب الهاتف من بطاقة RFID/NFC الموجودة على السيارة..."
                : "جارٍ التهيئة..."}
            </p>
            {!reading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            <X className="h-4 w-4 ml-1" /> إلغاء
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
