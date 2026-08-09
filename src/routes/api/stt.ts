import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size < 1024) {
          return new Response(JSON.stringify({ error: "التسجيل فاضي، جرّب تاني" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const type = (audio.type || "").split(";")[0];
        const ext =
          ({
            "audio/webm": "webm",
            "audio/mp4": "mp4",
            "audio/mpeg": "mp3",
            "audio/wav": "wav",
            "audio/ogg": "ogg",
          } as Record<string, string>)[type] ?? "webm";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", audio, `recording.${ext}`);

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return new Response(
            JSON.stringify({ error: "مش قادر أفهم الصوت، جرّب تاني", detail }),
            { status: res.status, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = (await res.json()) as { text?: string };
        return new Response(JSON.stringify({ text: data.text ?? "" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
