import { expect, test } from "bun:test";
import { isQuietHours } from "../src/lib/quiet-hours";
const at = (h: number, m: number) => new Date(2026, 10, 24, h, m);
test("app is closed from 11:59 pm until 4:00 am", () => {
  expect(isQuietHours(at(23, 58))).toBe(false);
  expect(isQuietHours(at(23, 59))).toBe(true);
  expect(isQuietHours(at(0, 0))).toBe(true);
  expect(isQuietHours(at(3, 59))).toBe(true);
  expect(isQuietHours(at(4, 0))).toBe(false);
});
