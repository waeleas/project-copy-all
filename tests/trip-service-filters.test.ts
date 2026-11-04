import { describe, expect, test } from "bun:test";
import { countTripsByService, filterTripsByService } from "../src/lib/trip-service-filters";

describe("managed service filters", () => {
  const trips = [
    { id: 1, service_type_id: "office" },
    { id: 2, service_type_id: "hours" },
    { id: 3, service_type_id: "office" },
    { id: 4, service_type_id: "new-service" },
  ];
  test("office, hours and newly added services each filter by their own identity", () => {
    expect(filterTripsByService(trips, "office").map(t => t.id)).toEqual([1, 3]);
    expect(filterTripsByService(trips, "hours").map(t => t.id)).toEqual([2]);
    expect(filterTripsByService(trips, "new-service").map(t => t.id)).toEqual([4]);
    expect(filterTripsByService(trips, "all")).toEqual(trips);
  });
  test("counts reflect every matching request, not just the displayed page", () => {
    const rows = Array.from({ length: 121 }, () => ({ service_type_id: "office" }));
    expect(countTripsByService([...rows, ...trips])).toEqual({ office: 123, hours: 1, "new-service": 1 });
    expect(filterTripsByService(trips, "empty-service")).toEqual([]);
  });
});