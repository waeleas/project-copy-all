export type ServiceTrip = { service_type_id?: string | null };

export function filterTripsByService<T extends ServiceTrip>(trips: T[], serviceId: string) {
  return serviceId === "all" ? trips : trips.filter((trip) => trip.service_type_id === serviceId);
}

export function countTripsByService(trips: ServiceTrip[]) {
  const counts: Record<string, number> = {};
  for (const trip of trips) {
    if (trip.service_type_id) counts[trip.service_type_id] = (counts[trip.service_type_id] ?? 0) + 1;
  }
  return counts;
}