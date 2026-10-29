import { supabase } from "@/integrations/supabase/client";
import { PHOTO_TARGET_BYTES, PHOTO_COMPRESSION_STEPS, retryPhotoOperation } from "@/lib/photo-upload-policy";

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
    const url = URL.createObjectURL(file);
    try {
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
      URL.revokeObjectURL(url);
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
async function compressImage(file: File | Blob): Promise<Blob | null> {
  let decoded = await decodeImage(file);
  if (!decoded && file instanceof File &&
    ((await sniffMime(file)) === "image/heic" || /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type))) {
    try {
      // Browser-only converter: load only after native decoding fails.
      const { default: convert } = await import("heic2any");
      const result = await convert({ blob: file, toType: "image/jpeg", quality: 0.6 });
      const converted = Array.isArray(result) ? result[0] : result;
      if (converted) decoded = await decodeImage(converted);
    } catch { /* Caller reports decoding failure, not a network error. */ }
  }
  if (!decoded || !decoded.w || !decoded.h) return null;

  let best: Blob | null = null;
  try {
    for (const step of PHOTO_COMPRESSION_STEPS) {
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
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= PHOTO_TARGET_BYTES) break;
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

export async function uploadOdometerPhoto(file: File, prefix: string, onStatus?: (status: string) => void): Promise<string> {
  const retryStatus = () => onStatus?.("الاتصال ضعيف، ننتظر ونحاول رفع الصورة مجددًا...");
  onStatus?.("جارٍ ضغط صورة العداد...");
  const compressed = await compressImage(file);
  if (!compressed || !compressed.size) {
    throw new Error("تعذر قراءة الصورة وضغطها. اختر صورة سليمة بصيغة JPG أو PNG أو HEIC");
  }
  const user = await retryPhotoOperation(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }, retryStatus);
  if (!user) throw new Error("غير مسجل");
  const path = `${user.id}/${prefix}-${crypto.randomUUID()}.jpg`;
  await retryPhotoOperation(async () => {
    onStatus?.("جارٍ رفع صورة العداد...");
    const { error } = await supabase.storage.from("odometer-photos").upload(path, compressed, {
      cacheControl: "3600", upsert: true, contentType: "image/jpeg",
    });
    if (error) throw error;
  }, retryStatus);
  return path;
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
