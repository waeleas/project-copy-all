import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** يحوّل الأرقام العربية-الهندية والفارسية إلى أرقام إنجليزية */
export function toEnglishDigits(input: string): string {
  if (!input) return input;
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

/** قراءة العداد: تقبل أرقامًا وفاصلة عشرية واحدة فقط (الكسور تُقتطع عند الحفظ) */
export function toOdometerInput(input: string): string {
  const cleaned = toEnglishDigits(input).replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

