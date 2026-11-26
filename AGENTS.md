<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep SAP operation-text formatting in a pure shared helper with regression tests so export normalization can be verified without accessing real trip data.
- Keep photo compression settings and recoverable-error retries in a browser-safe tested helper; uploads reuse a unique object path with upsert so lost responses never create duplicate originals, and HEIC conversion is dynamically imported only after native decoding fails.
- Open photo pickers through the shared lifecycle helper with a fresh native input per user gesture; cancellation and stale callbacks must never clear a previously selected photo or block reopening.
- Keep photo retention rules in a pure tested helper; cleanup must authenticate an admin or server-only schedule secret and protect objects referenced by recent requests before deleting through Storage API.
- Route user-facing failures through the browser-safe shared error classifier; classify using known codes/status/messages and keep unknown causes explicit, so provider diagnostics never leak through translation fragments.
- Return classified Arabic failures as plain results from public username lookup, preserving provider codes/status before classification, because production can redact thrown errors.
- Load the main trip list in bounded database pages for ordinary status/date browsing; text/service searches retain complete matching data, and Excel/SAP reports load all matching pages only on demand to preserve report completeness while reducing routine transfers. Keep loading ranges and device-local date bounds in a tested browser-safe helper.
- Derive service filter buttons from managed service IDs and use head-only counts during paged browsing; shared pure filter/count helpers keep new service types independent without downloading all trips for counters.
- Keep Excel registration-date formatting and additional-route date selection in a tested browser-safe helper so report-only date rules never modify stored trip or segment timestamps.
- Keep automatic starting-photo eligibility in a pure tested device-local calendar helper; return the previous reading date and status so the UI can enforce eligibility.
- Keep comparison-report odometer boundaries in a pure tested helper selecting the first and last completed trips chronologically within the requested period, not numeric extrema; stably order paged report reads to avoid gaps.
- Keep trip-distance validation in a shared tested browser-safe helper using managed role status, so closing and editing apply the same admin exception without changing odometer validity checks.
- Nightly closure 23:59–04:00 device time lives in src/lib/quiet-hours.ts (tested); AppShell renders a closed screen and disables queries then so the database can idle.
