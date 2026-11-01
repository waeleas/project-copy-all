import { describe, expect, test } from "bun:test";
import { photoCutoff, removablePhotoPaths } from "../src/lib/photo-retention";

describe("request photo retention", () => {
  test("retains three months as exactly 90 days", () => {
    expect(photoCutoff(Date.parse("2026-11-01T14:46:00Z"))).toBe("2026-08-03T14:46:00.000Z");
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