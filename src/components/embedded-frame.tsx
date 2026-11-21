import { useMemo } from "react";

/**
 * عنصر تضمين آمن: يعرض رابطًا خارجيًا (Iframe) أو كود HTML مخصصًا
 * داخل إطار معزول (sandbox) لا يصل لبيانات التطبيق.
 */
export function EmbeddedFrame({
  url,
  html,
  title = "محتوى مضمّن",
  height = 480,
  className = "",
}: {
  /** رابط خارجي يُعرض داخل الإطار */
  url?: string;
  /** كود HTML مخصص يُعرض داخل الإطار (يُستخدم إن لم يوجد رابط) */
  html?: string;
  title?: string;
  height?: number;
  className?: string;
}) {
  const srcDoc = useMemo(() => {
    if (url || !html) return undefined;
    return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;font-family:sans-serif">${html}</body></html>`;
  }, [url, html]);

  if (!url && !html) return null;

  return (
    <iframe
      title={title}
      src={url}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      referrerPolicy="no-referrer"
      loading="lazy"
      className={`w-full rounded-xl border bg-card ${className}`}
      style={{ height }}
    />
  );
}
