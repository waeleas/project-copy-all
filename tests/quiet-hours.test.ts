import { expect, test } from "bun:test";
import { isQuietHours } from "../src/lib/quiet-hours";
const at = (h: number, m: number) => new Date(2026, 10, 24, h, m);
test("app is closed from 11:59 pm until 2:00 am", () => {
  expect(isQuietHours(at(23, 58))).toBe(false);
  expect(isQuietHours(at(23, 59))).toBe(true);
  expect(isQuietHours(at(1, 59))).toBe(true);
  expect(isQuietHours(at(2, 0))).toBe(false);
});
