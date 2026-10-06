/** Format the initial route and ordered extra routes for SAP's 40-character field. */
export function sapOperationText(startRoute: unknown, extraRoutes: unknown[] = []): string {
  const places = [startRoute, ...extraRoutes]
    .map((route) => String(route ?? "").trim())
    // Match whole words, not letters inside place names such as المنصورة.
    .map((route) => route.replace(/(^|[\s,،;؛\-–—])(?:من|إلى|الى|الي|وصول)(?=$|[\s,،;؛\-–—])/gu, "$1-"))
    .join("-")
    .split(/[\-–—,،;؛]+/u)
    .map((place) => place.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .map((place) => place === "التجمع الخامس" ? "التجمع" : place);

  return places.join("-").slice(0, 40).replace(/-+$/u, "");
}