const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function tripReportDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()}-${MONTHS[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
}

export function additionalRouteReportDate(trip: { start_at?: string | null }) {
  return tripReportDate(trip.start_at);
}