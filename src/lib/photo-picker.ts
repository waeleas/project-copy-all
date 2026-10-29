// Each user gesture owns a fresh native input. No cancelled session is reused.
export function openPhotoPicker(onFile: (file: File) => void, accept?: string): () => void {
  const input = document.createElement("input");
  input.type = "file";
  if (accept) input.accept = accept;
  input.className = "sr-only";
  input.tabIndex = -1;
  document.body.appendChild(input);

  let active = true;
  let returnTimer: ReturnType<typeof setTimeout> | undefined;
  const interval = setInterval(check, 300);

  function cleanup() {
    if (!active) return;
    active = false;
    clearInterval(interval);
    clearTimeout(returnTimer);
    input.removeEventListener("change", changed);
    input.removeEventListener("cancel", cleanup);
    document.removeEventListener("visibilitychange", returned);
    window.removeEventListener("focus", returned);
    window.removeEventListener("pageshow", returned);
    input.remove();
  }

  function check() {
    if (!active) return;
    const file = input.files?.[0];
    if (!file) return;
    cleanup();
    onFile(file);
  }

  function changed() {
    check();
    // An empty change is cancellation, not removal of the previous photo.
    cleanup();
  }

  function returned() {
    if (!active || document.visibilityState === "hidden") return;
    check();
    if (!active) return;
    clearTimeout(returnTimer);
    // Android may deliver change after focus/visibility. Keep listening briefly.
    returnTimer = setTimeout(() => {
      check();
      cleanup();
    }, 3000);
  }

  input.addEventListener("change", changed);
  input.addEventListener("cancel", cleanup);
  document.addEventListener("visibilitychange", returned);
  window.addEventListener("focus", returned);
  window.addEventListener("pageshow", returned);
  try {
    input.click();
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}