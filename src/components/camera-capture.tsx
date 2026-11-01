import { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { arabicError } from "@/lib/errors";

interface Props {
  onCapture: (file: File) => void;
  trigger?: React.ReactNode;
}

export function CameraCapture({ onCapture, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open || shot) return;
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("المتصفح لا يدعم الكاميرا");
        }
        // أولوية أولى للكاميرا: إن كانت مشغولة بتطبيق آخر في الخلفية نعيد المحاولة
        let stream: MediaStream | null = null;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
              audio: false,
            });
            break;
          } catch (err: any) {
            lastErr = err;
            const name = String(err?.name || "");
            if (name.includes("NotReadable") || name.includes("AbortError") || name.includes("TrackStart")) {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
              await new Promise((r) => setTimeout(r, 600));
              continue;
            }
            throw err;
          }
        }
        if (!stream) throw lastErr ?? new Error("NotReadableError");
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        toast.error(arabicError(e, "تعذر فتح الكاميرا؛ لم يحدد الجهاز سببًا واضحًا"));
        setOpen(false);
      }
    };
    void start();
    // استئناف الكاميرا فوراً عند العودة من تطبيق آخر كان يعمل في الخلفية
    const onVisible = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      const live = streamRef.current?.getVideoTracks().some((t) => t.readyState === "live");
      if (!live) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void start();
      } else {
        videoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [open, shot]);


  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (!open) {
      stopStream();
      setShot(null);
    }
    return () => stopStream();
  }, [open]);

  function capture() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setShot(c.toDataURL("image/jpeg", 0.9));
    stopStream();
  }

  function accept() {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        setOpen(false);
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <>
      <div onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <button type="button" className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-1 cursor-pointer hover:bg-accent/30 text-sm w-full">
            <Camera className="size-5 text-primary" />
            <span>الكاميرا</span>
          </button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="relative bg-black aspect-[3/4] flex items-center justify-center">
            {!shot ? (
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            ) : (
              <img src={shot} alt="معاينة" className="w-full h-full object-contain" />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="p-3 flex items-center justify-between gap-2 bg-background">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              <X className="size-4 ml-1" /> إلغاء
            </Button>
            {!shot ? (
              <Button onClick={capture}>
                <Camera className="size-4 ml-1" /> التقاط
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShot(null)}>
                  <RotateCcw className="size-4 ml-1" /> إعادة
                </Button>
                <Button onClick={accept}>
                  <Check className="size-4 ml-1" /> استخدام
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
