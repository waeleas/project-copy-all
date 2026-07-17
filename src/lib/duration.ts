export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} يوم`);
  if (hours) parts.push(`${hours} ساعة`);
  parts.push(`${mins} دقيقة`);
  return parts.join(" و ");
}

export function tripDurationMs(trip: { start_at: string; end_at?: string | null; status?: string }, now: number): number {
  const start = new Date(trip.start_at).getTime();
  const end = trip.end_at ? new Date(trip.end_at).getTime() : now;
  return end - start;
}
