type ReadingTrip = {
  id: string;
  car_plate: string | null;
  start_at: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
};

/** First/last completed requests by trip start time, never numeric extrema. */
export function comparisonOdometers(
  trips: ReadingTrip[],
  range: { from?: string | null; to?: string | null } = {},
) {
  const lower = range.from ? Date.parse(range.from) : -Infinity;
  const upper = range.to ? Date.parse(range.to) : Infinity;
  const ordered = trips.filter((trip) => {
    const at = trip.start_at ? Date.parse(trip.start_at) : NaN;
    return Number.isFinite(at) && at >= lower && at <= upper &&
      trip.end_odometer !== null && trip.start_odometer !== null;
  }).sort((a, b) => Date.parse(a.start_at ?? "") - Date.parse(b.start_at ?? "") || a.id.localeCompare(b.id));
  const readings = new Map<string, { first: number; last: number }>();
  for (const trip of ordered) {
    const plate = trip.car_plate?.trim();
    if (!plate || trip.start_odometer === null || trip.end_odometer === null) continue;
    const previous = readings.get(plate);
    readings.set(plate, { first: previous?.first ?? trip.start_odometer, last: trip.end_odometer });
  }
  return readings;
}