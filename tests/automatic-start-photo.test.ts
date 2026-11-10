import { expect, test } from "bun:test";
import { canReuseStartPhoto } from "../src/lib/automatic-start-photo";
const now = new Date(2026, 10, 10, 14);
const previous = { status: "closed", at: new Date(2026, 10, 9, 0, 1).toISOString(), reading: 12500 };
test("yesterday qualifies even beyond 24 hours", () => {
  expect(canReuseStartPhoto(previous, "12500", now)).toBe(true);
});
test("an intervening day prevents reuse", () => {
  expect(canReuseStartPhoto({ ...previous, at: new Date(2026, 10, 8, 23, 59).toISOString() }, "12500", now)).toBe(false);
});
test("today does not qualify", () => {
  expect(canReuseStartPhoto({ ...previous, at: new Date(2026, 10, 10, 1).toISOString() }, "12500", now)).toBe(false);
});
test("open trips cannot supply automatic photos", () => {
  expect(canReuseStartPhoto({ ...previous, status: "open" }, "12500", now)).toBe(false);
});
test("readings must match", () => {
  expect(canReuseStartPhoto(previous, "12501", now)).toBe(false);
});
test("month and year rollover works", () => {
  expect(canReuseStartPhoto({ ...previous, at: new Date(2025, 11, 31, 23).toISOString() }, "12500", new Date(2026, 0, 1, 9))).toBe(true);
});
test("unknown dates never qualify", () => {
  expect(canReuseStartPhoto({ ...previous, at: null }, "12500", now)).toBe(false);
  expect(canReuseStartPhoto({ ...previous, at: "invalid" }, "12500", now)).toBe(false);
});