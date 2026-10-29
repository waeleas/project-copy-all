import { describe, expect, test } from "bun:test";
import { PHOTO_TARGET_BYTES, PHOTO_COMPRESSION_STEPS, isRecoverablePhotoError, retryPhotoOperation } from "../src/lib/photo-upload-policy";

describe("photo upload reliability", () => {
  test("compression targets 30 KB with a readable 480px minimum", () => {
    expect(PHOTO_TARGET_BYTES).toBe(30 * 1024);
    expect(PHOTO_COMPRESSION_STEPS.at(-1)).toEqual({ maxDim: 480, quality: 0.16 });
  });
  test("weak networks continue beyond the old five-attempt limit", async () => {
    let calls = 0;
    const delays: number[] = [];
    const result = await retryPhotoOperation(async () => {
      if (++calls <= 8) throw new TypeError("Failed to fetch");
      return "stored-photo";
    }, undefined, async ms => { delays.push(ms); });
    expect(result).toBe("stored-photo");
    expect(calls).toBe(9);
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
  test.each([408, 429, 500, 502, 503, 504])("retry temporary status %s even with unfamiliar message", status => {
    expect(isRecoverablePhotoError({ statusCode: String(status), message: "temporary" })).toBe(true);
  });
  test.each([400, 401, 403, 413, 415])("do not wait forever for permanent status %s", status => {
    expect(isRecoverablePhotoError({ statusCode: status, message: "upload failed to complete" })).toBe(false);
  });
  test("permanent errors stop immediately without a second upload", async () => {
    let calls = 0;
    const error = { statusCode: 403, message: "denied" };
    await expect(retryPhotoOperation(async () => { calls++; throw error; }, undefined, async () => {})).rejects.toEqual(error);
    expect(calls).toBe(1);
  });
});