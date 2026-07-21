import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB (raw camera photos can be large)

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

async function compressImage(file: File | Blob, maxDim = 1400, quality = 0.72): Promise<Blob | null> {
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

export async function uploadOdometerPhoto(file: File, prefix: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجل");

  if (file.size > MAX_BYTES) throw new Error("حجم الملف أكبر من 15 ميجابايت");

  const sniffed = await sniffMime(file);
  const declared = (file.type || "").toLowerCase();

  // Try to decode + compress as image regardless of extension/MIME
  const compressed = await compressImage(file);

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
    // Successfully decoded as an image — always use compressed JPEG
    finalBlob = compressed.size < file.size ? compressed : (sniffed === "image/heic" ? compressed : file);
    if (finalBlob === compressed) {
      finalType = "image/jpeg";
      safeExt = "jpg";
    } else {
      safeExt = extMap[finalType] || (file.name.split(".").pop() || "jpg").toLowerCase();
    }
  } else {
    // Could not decode — keep original, derive extension from filename
    const nameExt = (file.name.split(".").pop() || "").toLowerCase();
    safeExt = extMap[finalType] || nameExt || "bin";
    if (!finalType || finalType === "application/octet-stream") {
      finalType = file.type || "application/octet-stream";
    }
  }

  const path = `${user.id}/${prefix}-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage.from("odometer-photos").upload(path, finalBlob, {
    cacheControl: "3600",
    upsert: false,
    contentType: finalType,
  });
  if (error) throw error;
  return path;
}

export async function getSignedPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("odometer-photos")
    .createSignedUrl(path, 60 * 60 * 24); // 24h
  if (error) throw error;
  return data.signedUrl;
}
