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
const TARGET_BYTES = 45 * 1024; // ~45KB هدف مضغوط جداً مع الحفاظ على وضوح أرقام العداد

async function compressImage(file: File | Blob): Promise<Blob | null> {
  const decoded = await decodeImage(file);
  if (!decoded || !decoded.w || !decoded.h) return null;

  const steps: Array<{ maxDim: number; quality: number }> = [
    { maxDim: 1000, quality: 0.5 },
    { maxDim: 900, quality: 0.42 },
    { maxDim: 800, quality: 0.36 },
    { maxDim: 720, quality: 0.3 },
    { maxDim: 640, quality: 0.26 },
    { maxDim: 560, quality: 0.22 },
    { maxDim: 480, quality: 0.2 },
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

/** مصغّرة للمعاينة تعمل مع أي صيغة يستطيع المتصفح فك ترميزها (heic/avif...) */
export async function makeThumbnail(file: File | Blob, maxDim = 900): Promise<string | null> {
  const decoded = await decodeImage(file);
  if (!decoded || !decoded.w || !decoded.h) return null;
  try {
    const scale = Math.min(1, maxDim / Math.max(decoded.w, decoded.h));
    const w = Math.max(1, Math.round(decoded.w * scale));
    const h = Math.max(1, Math.round(decoded.h * scale));
    const canvas = makeCanvas(w, h);
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(decoded.draw, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.7);
    if (!blob) return null;
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || "") || null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    decoded.close?.();
  }
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

  // أخطاء شبكية/مؤقتة تستحق إعادة المحاولة
  const isRetryable = (m: string) =>
    /network|fetch|timeout|abort|load|failed|503|502|504|429|econn|socket|reset|unavailable|internal/.test(m);

  // إعادة المحاولة تلقائياً في حال ضعف الشبكة (5 محاولات مع تأخير متزايد)
  let lastErr: any = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const { error } = await supabase.storage.from("odometer-photos").upload(path, finalBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: finalType,
      });
      if (!error) return path;
      lastErr = error;
      const msg = String(error.message || "").toLowerCase();
      if (!isRetryable(msg)) throw error;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "").toLowerCase();
      if (!isRetryable(msg)) throw e;
    }
    if (attempt < 5) await sleep(500 * attempt);
  }

  // محاولة أخيرة: رفع الملف الأصلي كما هو إن فشل رفع النسخة المضغوطة
  if (finalBlob !== file) {
    try {
      const rawPath = `${user.id}/${prefix}-${Date.now()}-raw.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { error } = await supabase.storage.from("odometer-photos").upload(rawPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });
      if (!error) return rawPath;
    } catch {
      // نكمل للخطأ النهائي
    }
  }

  const msg = String(lastErr?.message || "").toLowerCase();
  if (isRetryable(msg)) {
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
