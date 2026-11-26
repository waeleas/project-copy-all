export const TRIP_PAGE_SIZE = 100;

export function currentMonthRange(now: Date = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    from: `${prefix}-01`,
    to: `${prefix}-${new Date(year, month + 1, 0).getDate()}`,
  };
}

export function tripPageRange(page: number) {
  const from = (Math.max(1, Math.floor(page)) - 1) * TRIP_PAGE_SIZE;
  return { from, to: from + TRIP_PAGE_SIZE - 1 };
}

export async function loadAllTripPages<T>(load: (from: number, to: number) => Promise<T[]>) {
  const rows: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const batch = await load(from, from + size - 1);
    rows.push(...batch);
    if (batch.length < size) return rows;
  }
}

export function tripDateBounds(from: string, to: string) {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T00:00:00`) : null;
  end?.setHours(23, 59, 59, 999);
  return { start: start?.toISOString(), end: end?.toISOString() };
}