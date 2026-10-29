export const PHOTO_TARGET_BYTES = 30 * 1024;
export const PHOTO_COMPRESSION_STEPS = [
  { maxDim: 1000, quality: 0.45 },
  { maxDim: 900, quality: 0.36 },
  { maxDim: 800, quality: 0.30 },
  { maxDim: 720, quality: 0.26 },
  { maxDim: 640, quality: 0.22 },
  { maxDim: 560, quality: 0.18 },
  { maxDim: 480, quality: 0.16 },
] as const;

export function isRecoverablePhotoError(error: unknown): boolean {
  const err = error as { message?: string; status?: number; statusCode?: number | string } | null;
  const status = Number(err?.statusCode ?? err?.status);
  if ([408, 425, 429].includes(status) || status >= 500) return true;
  if (status >= 400 && status < 500) return false;
  return /network|fetch|timeout|timed out|abort|load failed|failed to|econn|socket|reset|unavailable|internal|connection|offline/i.test(err?.message ?? String(error));
}

/** No attempt limit for temporary network errors; never retry permanent rejection. */
export async function retryPhotoOperation<T>(
  operation: () => Promise<T>,
  onRetry?: (attempt: number) => void,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try { return await operation(); }
    catch (error) {
      if (!isRecoverablePhotoError(error)) throw error;
      attempt++;
      onRetry?.(attempt);
      await wait(Math.min(1000 * 2 ** Math.min(attempt - 1, 5), 30000));
    }
  }
}