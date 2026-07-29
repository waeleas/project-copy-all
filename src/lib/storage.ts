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

// أكثر عدوانية في الضغط لتقليل استهلاك الشبكة للسائقين ذوي الباقات الضعيفة
async function compressImage(file: File | Blob, maxDim = 1100, quality = 0.6): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as any).getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    if ("convertToBlob" in canvas) {
      return await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality });
    }
    return await new Promise<Blob>((resolve, reject) =>
      (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", quality)
    );
  } catch {
    return null;
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

  if (!sniffed && declared && !declared.startsWith("image/")) {
    throw new Error("الملف المختار ليس صورة، اختر صورة عداد واضحة");
  }

  const compressed = await compressImage(file);

  if (sniffed === "image/heic" && !compressed) {
    throw new Error("صيغة صورة الآيفون HEIC غير مدعومة على هذا الجهاز. افتح الكاميرا من داخل البرنامج أو اختر صورة JPG / PNG");
  }

  let finalBlob: Blob = file;
  let finalType = sniffed || declared || "application/octet-stream";
  let safeExt = "bin";

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };

  if (compressed) {
    finalBlob = compressed.size < file.size ? compressed : (sniffed === "image/heic" ? compressed : file);
    if (finalBlob === compressed) {
      finalType = "image/jpeg";
      safeExt = "jpg";
    } else {
      safeExt = extMap[finalType] || (file.name.split(".").pop() || "jpg").toLowerCase();
    }
  } else {
    const nameExt = (file.name.split(".").pop() || "").toLowerCase();
    safeExt = extMap[finalType] || nameExt || "bin";
    if (!finalType || finalType === "application/octet-stream") {
      finalType = file.type || "application/octet-stream";
    }
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(finalType)) {
    throw new Error("نوع الصورة غير مدعوم. استخدم صورة JPG أو PNG أو WEBP");
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
