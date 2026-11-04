import { expect, test } from "bun:test";
import { additionalRouteReportDate, tripReportDate } from "../src/lib/trip-report-date";

test("additional-route registration date matches trip start even when entered on another day", () => {
  const trip = { start_at: "2026-10-05T10:00:00", created_at: "2026-10-08T10:00:00" };
  expect(additionalRouteReportDate(trip)).toBe("5-Oct-26");
  expect(additionalRouteReportDate(trip)).toBe(tripReportDate(trip.start_at));
  expect(additionalRouteReportDate(trip)).not.toBe(tripReportDate(trip.created_at));
});