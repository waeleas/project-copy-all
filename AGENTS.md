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
- Keep photo retention rules in a pure tested helper; cleanup must authenticate an admin or server-only schedule secret and protect objects referenced by recent requests before deleting through Storage API.
- Load the main trip list in bounded database pages for ordinary status/date browsing; text/service searches retain complete matching data, and Excel/SAP reports load all matching pages only on demand to preserve report completeness while reducing routine transfers. Keep loading ranges and device-local date bounds in a tested browser-safe helper.
