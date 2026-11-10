/** Compare calendar days in the device timezone, not a rolling 24 hours. */
export function canReuseStartPhoto(previous: { status: string; at: string | null; reading: number | null }, startReading: string, now = new Date()): boolean {
  if (previous.status !== "closed" || !previous.at || previous.reading == null || !startReading.trim() || Number(startReading) !== previous.reading) return false;
  const at = new Date(previous.at);
  if (!Number.isFinite(at.getTime()) || !Number.isFinite(now.getTime())) return false;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return at.getFullYear() === yesterday.getFullYear() && at.getMonth() === yesterday.getMonth() && at.getDate() === yesterday.getDate();
}