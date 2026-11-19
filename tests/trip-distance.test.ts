import { describe, expect, test } from "bun:test";
import { exceedsTripDistanceLimit } from "../src/lib/trip-distance";

describe("trip distance limit", () => {
  test("admins can exceed 1000 km when closing or editing a request", () => {
    expect(exceedsTripDistanceLimit(5000, 6001, true)).toBe(false);
    expect(exceedsTripDistanceLimit(5000, 25000, true)).toBe(false);
  });
  test("ordinary users retain the 1000 km limit", () => {
    expect(exceedsTripDistanceLimit(5000, 6000, false)).toBe(false);
    expect(exceedsTripDistanceLimit(5000, 6001, false)).toBe(true);
  });
  test("creation without an ending reading has no distance to restrict", () => {
    expect(exceedsTripDistanceLimit(5000, null, true)).toBe(false);
    expect(exceedsTripDistanceLimit(5000, null, false)).toBe(false);
  });
});