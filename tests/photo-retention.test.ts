import { describe, expect, test } from "bun:test";
import { photoCutoff, removablePhotoPaths } from "../src/lib/photo-retention";

describe("request photo retention", () => {
  test("retains exactly 30 days", () => {
    expect(photoCutoff(Date.parse("2026-10-26T05:39:00Z"))).toBe("2026-09-26T05:39:00.000Z");
  });
  test("does not delete photos still referenced by recent requests", () => {
    expect(removablePhotoPaths(["user/old.jpg", "user/shared.jpg"], ["user/shared.jpg"]))
      .toEqual(["user/old.jpg"]);
  });
  test("only deletes distinct bucket objects, not placeholders or external images", () => {
    expect(removablePhotoPaths(["u/a.jpg", "u/a.jpg", "/placeholder.jpg", "https://example.com/a.jpg", null], []))
      .toEqual(["u/a.jpg"]);
  });
});