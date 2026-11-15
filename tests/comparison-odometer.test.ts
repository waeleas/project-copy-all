import { describe, expect, test } from "bun:test";
import { comparisonOdometers } from "../src/lib/comparison-odometer";

const trip = (id: string, start_at: string, start: number, end: number | null, plate = "8926م ط ف") =>
  ({ id, start_at, start_odometer: start, end_odometer: end, car_plate: plate });

describe("comparison period odometers", () => {
  test("uses first and last chronological readings inside the selected dates, not extrema or outside trips", () => {
    const rows = [
      trip("after", "2026-10-09T00:00:00Z", 999999, 1000000),
      trip("last", "2026-10-08T20:00:00Z", 13000, 13100),
      trip("before", "2026-10-07T23:59:59Z", 1, 2),
      trip("middle", "2026-10-08T12:00:00Z", 9000, 20000),
      trip("first", "2026-10-08T00:00:00Z", 12500, 12600),
    ];
    expect(comparisonOdometers(rows, { from: "2026-10-08T00:00:00Z", to: "2026-10-08T23:59:59.999Z" }).get("8926م ط ف"))
      .toEqual({ first: 12500, last: 13100 });
  });
  test("preserves zero and keeps cars separate, excluding unfinished requests", () => {
    expect([...comparisonOdometers([
      trip("a", "2026-10-08T01:00:00Z", 0, 20),
      trip("b", "2026-10-08T02:00:00Z", 20, 40),
      trip("c", "2026-10-08T03:00:00Z", 40, null),
      trip("d", "2026-10-08T02:00:00Z", 100, 150, "other"),
    ])]).toEqual([["8926م ط ف", { first: 0, last: 40 }], ["other", { first: 100, last: 150 }]]);
  });
  test("one-sided date bounds still select only readings in the period", () => {
    const rows = [trip("a", "2026-10-07T12:00:00Z", 100, 200), trip("b", "2026-10-08T12:00:00Z", 200, 300)];
    expect(comparisonOdometers(rows, { from: "2026-10-08T00:00:00Z" }).get("8926م ط ف"))
      .toEqual({ first: 200, last: 300 });
    expect(comparisonOdometers(rows, { to: "2026-10-07T23:59:59.999Z" }).get("8926م ط ف"))
      .toEqual({ first: 100, last: 200 });
  });
});