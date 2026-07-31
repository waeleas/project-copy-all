import { supabase } from "@/integrations/supabase/client";

export const MAX_ODOMETER_PHOTO_BYTES = 15 * 1024 * 1024; // 15 MB (raw camera photos can be large)

// Magic-byte sniffing — source of truth for image type
async function sniffMime(file: File): Promise<string | null> {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  // HEIC / HEIF: ftyp box at offset 4
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

// فك ترميز الصورة بأي صيغة يدعمها المتصفح (bitmap أولاً ثم عنصر img كبديل)
async function decodeImage(file: File | Blob): Promise<{ draw: CanvasImageSource; w: number; h: number; close?: () => void } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    return { draw: bitmap, w: bitmap.width, h: bitmap.height, close: () => bitmap.close?.() };
  } catch {
    // fallback: <img> يدعم صيغاً إضافية (heic على iOS، avif، gif، bmp، svg...)
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode failed"));
        el.src = url;
      });
      return {
        draw: img,
        w: img.naturalWidth,
        h: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch {
      return null;
    }
  }
}

function makeCanvas(w: number, h: number) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function canvasToBlob(canvas: any, type: string, quality: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    try {
      return await (canvas as OffscreenCanvas).convertToBlob({ type, quality });
    } catch {
      return null;
    }
  }
  return await new Promise<Blob | null>((resolve) =>
    (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality),
  );
}

/**
 * ضغط قوي مع الحفاظ على وضوح أرقام العداد:
 * نبدأ بأبعاد وجودة جيدة ثم نخفض تدريجياً حتى نصل لحجم هدف صغير.
 */
const TARGET_BYTES = 220 * 1024; // ~220KB هدف مناسب للباقات الضعيفة

async function compressImage(file: File | Blob): Promise<Blob | null> {
  const decoded = await decodeImage(file);
  if (!decoded || !decoded.w || !decoded.h) return null;

  const steps: Array<{ maxDim: number; quality: number }> = [
    { maxDim: 1600, quality: 0.72 },
    { maxDim: 1400, quality: 0.65 },
    { maxDim: 1200, quality: 0.58 },
    { maxDim: 1000, quality: 0.5 },
    { maxDim: 900, quality: 0.42 },
  ];

  let best: Blob | null = null;
  try {
    for (const step of steps) {
      // إفساح المجال للواجهة حتى لا يتجمد التطبيق أثناء الضغط
      await new Promise((r) => setTimeout(r, 0));
      const scale = Math.min(1, step.maxDim / Math.max(decoded.w, decoded.h));
      const w = Math.max(1, Math.round(decoded.w * scale));
      const h = Math.max(1, Math.round(decoded.h * scale));
      const canvas = makeCanvas(w, h);
      const ctx = (canvas as any).getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // خلفية بيضاء للصيغ الشفافة (png/webp) حتى لا تصبح سوداء بعد التحويل لـ jpeg
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(decoded.draw, 0, 0, w, h);
      const blob = await canvasToBlob(canvas, "image/jpeg", step.quality);
      if (!blob) continue;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
  } finally {
    decoded.close?.();
  }
  return best;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function uploadOdometerPhoto(file: File, prefix: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجل");

  if (file.size > MAX_ODOMETER_PHOTO_BYTES) throw new Error("حجم الصورة كبير جداً، اختر صورة أقل من 15 ميجابايت");

  const sniffed = await sniffMime(file);
  const declared = (file.type || "").toLowerCase();

  // نقبل أي امتداد صورة؛ نحاول دائماً التحويل إلى JPEG مضغوط
  const compressed = await compressImage(file);

  let finalBlob: Blob;
  let finalType: string;
  let safeExt: string;

  if (compressed && compressed.size > 0) {
    finalBlob = compressed;
    finalType = "image/jpeg";
    safeExt = "jpg";
  } else {
    // تعذّر فك الترميز في هذا المتصفح — نرفع الملف كما هو إن كان صورة
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
      "image/avif": "avif",
      "image/gif": "gif",
      "image/bmp": "bmp",
      "image/tiff": "tiff",
    };
    const nameExt = (file.name.split(".").pop() || "").toLowerCase();
    const looksImage = !!sniffed || declared.startsWith("image/") ||
      ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif", "bmp", "tif", "tiff"].includes(nameExt);
    if (!looksImage) {
      throw new Error("الملف المختار ليس صورة، اختر صورة عداد واضحة");
    }
    finalBlob = file;
    finalType = sniffed || (declared.startsWith("image/") ? declared : "") || "image/jpeg";
    safeExt = extMap[finalType] || nameExt || "jpg";
  }

  const path = `${user.id}/${prefix}-${Date.now()}.${safeExt}`;

  // إعادة المحاولة تلقائياً في حال ضعف الشبكة (3 محاولات مع تأخير متزايد)
  let lastErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await supabase.storage.from("odometer-photos").upload(path, finalBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: finalType,
      });
      if (!error) return path;
      lastErr = error;
      const msg = String(error.message || "").toLowerCase();
      // لا نعيد المحاولة عند الأخطاء غير الشبكية
      if (!/network|fetch|timeout|abort|load|503|502|504/.test(msg)) throw error;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "").toLowerCase();
      if (!/network|fetch|timeout|abort|load|503|502|504/.test(msg)) throw e;
    }
    if (attempt < 3) await sleep(600 * attempt);
  }
  const msg = String(lastErr?.message || "").toLowerCase();
  if (/network|fetch|timeout|abort|load|503|502|504/.test(msg)) {
    throw new Error("تعذر رفع الصورة بسبب ضعف الشبكة. جرّب مرة أخرى أو التقط صورة أوضح بحجم أقل");
  }
  throw lastErr ?? new Error("تعذر رفع الصورة، الشبكة ضعيفة");
}

export async function getSignedPhotoUrl(path: string): Promise<string> {
  // Absolute URLs (e.g. placeholder CDN images from imported historical trips)
  // are returned as-is; only bucket paths need a signed URL.
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  const { data, error } = await supabase.storage
    .from("odometer-photos")
    .createSignedUrl(path, 60 * 60 * 24); // 24h
  if (error) throw error;
  return data.signedUrl;
}
