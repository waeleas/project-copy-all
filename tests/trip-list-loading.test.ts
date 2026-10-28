import { describe, expect, test } from "bun:test";
import { loadAllTripPages, tripDateBounds, tripPageRange } from "../src/lib/trip-list-loading";

describe("trip list loading", () => {
  test("list loads only 100 trips per page without overlapping pages", () => {
    expect(tripPageRange(1)).toEqual({ from: 0, to: 99 });
    expect(tripPageRange(2)).toEqual({ from: 100, to: 199 });
  });
  test("report loading preserves all trips beyond a single list page", async () => {
    const source = Array.from({ length: 2150 }, (_, id) => ({ id }));
    const calls: number[][] = [];
    const rows = await loadAllTripPages(async (from, to) => {
      calls.push([from, to]);
      return source.slice(from, to + 1);
    });
    expect(rows).toEqual(source);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  test("same-day filter includes the complete device-local day", () => {
    const bounds = tripDateBounds("2026-10-08", "2026-10-08");
    expect(bounds.start).toBe(new Date(2026, 9, 8, 0, 0, 0, 0).toISOString());
    expect(bounds.end).toBe(new Date(2026, 9, 8, 23, 59, 59, 999).toISOString());
  });
});