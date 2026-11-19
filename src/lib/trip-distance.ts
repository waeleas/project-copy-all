/** Admin status must come from the authenticated user's managed roles. */
export function exceedsTripDistanceLimit(start: number, end: number | null, isAdmin: boolean): boolean {
  return !isAdmin && end !== null && end - start > 1000;
}