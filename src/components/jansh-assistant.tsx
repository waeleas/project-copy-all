import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { X, RotateCcw, ImagePlus, Mic, MicOff, Volume2, Square, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import janshAvatar from "@/assets/jansh-avatar.png";

const POS_KEY = "jansh.bubble.pos.v1";

const SUGGESTIONS = [
  "إزاي أسجل قراءة العداد صح؟",
  "فحص سريع للعربية قبل ما أتحرك",
  "العربية وقفت في الطريق، أعمل إيه؟",
];

/** ضغط الصورة لحجم صغير مناسب للإرسال والتخزين */
async function compressToDataUrl(file: File): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = bitmapUrl;
    });
    const max = 900;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

function textOf(m: UIMessage) {
  return m.parts.map((p: any) => (p.type === "text" ? p.text : "")).join("");
}
function imageOf(m: UIMessage): string | null {
  const part: any = m.parts.find((p: any) => p.type === "file" && String(p.mediaType ?? "").startsWith("image/"));
  return part?.url ?? null;
}

export function JanshAssistant() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const { user } = useAuth();

  /* ===== موضع الفقاعة (قابلة للتحريك) ===== */
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 400 };
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { x: 16, y: Math.max(80, window.innerHeight - 200) };
  });
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.min(window.innerWidth - 70, Math.max(4, e.clientX - d.dx));
    const ny = Math.min(window.innerHeight - 70, Math.max(4, e.clientY - d.dy));
    if (Math.abs(nx - pos.x) > 3 || Math.abs(ny - pos.y) > 3) d.moved = true;
    setPos({ x: nx, y: ny });
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) setOpen(true);
    try {
      window.localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {}
  };

  /* ===== سياق السائق ===== */
  const { data: ctx } = useQuery({
    queryKey: ["jansh-context", user?.id],
    enabled: !!user?.id && open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      const { data: trip } = await supabase
        .from("trips")
        .select("trip_no, car_code, car_plate, car_description, status, route_start")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const vehicle = trip
        ? [trip.car_code, trip.car_plate, trip.car_description].filter(Boolean).join(" - ")
        : "";
      const tripStatus = trip
        ? trip.status === "open"
          ? `رحلة مفتوحة رقم ${trip.trip_no} من ${trip.route_start ?? "-"}`
          : `آخر رحلة رقم ${trip.trip_no} مكتملة`
        : "مفيش رحلات مسجلة";

      return {
        driver_name: profile?.display_name || user!.email || "سائق",
        vehicle_info: vehicle || "غير محددة",
        trip_status: tripStatus,
      };
    },
  });

  /* ===== تحميل المحادثة من قاعدة البيانات (خاصة بكل مستخدم) ===== */
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("chat_messages" as any)
        .select("id, role, content, image_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      const msgs: UIMessage[] = ((data as any[]) ?? []).map((r) => ({
        id: r.id,
        role: r.role,
        parts: [
          ...(r.image_url ? [{ type: "file", mediaType: "image/jpeg", url: r.image_url } as any] : []),
          { type: "text", text: r.content ?? "" } as any,
        ],
      }));
      setInitial(msgs);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persist = useCallback(
    async (role: "user" | "assistant", content: string, imageUrl?: string | null) => {
      if (!user?.id) return;
      await supabase.from("chat_messages" as any).insert({
        user_id: user.id,
        role,
        content,
        image_url: imageUrl ?? null,
      });
    },
    [user?.id],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `jansh-${user?.id ?? "guest"}`,
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }: any) => {
      void persist("assistant", textOf(message as UIMessage));
    },
    onError: () => toast.error("معلش، حصلت مشكلة في الاتصال بجنش — جرّب تاني"),
  });

  useEffect(() => {
    if (ready && initial.length) setMessages(initial);
  }, [ready, initial, setMessages]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open, status]);

  const busy = status === "submitted" || status === "streaming";

  function send(value: string) {
    const trimmed = value.trim();
    if ((!trimmed && !image) || busy) return;
    const img = image;
    setText("");
    setImage(null);
    void persist("user", trimmed, img);
    void sendMessage(
      {
        text: trimmed || "شوف الصورة دي",
        ...(img ? { files: [{ type: "file", mediaType: "image/jpeg", url: img } as any] } : {}),
      } as any,
      { body: { context: ctx } },
    );
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setImage(await compressToDataUrl(f));
    } catch {
      toast.error("مش قادر أقرأ الصورة دي، جرّب صورة تانية");
    }
  }

  /* ===== الميكروفون: SpeechRecognition لو متاح، وإلا تسجيل + تفريغ على الخادم ===== */
  const mediaRef = useRef<{ rec: MediaRecorder; chunks: BlobPart[] } | null>(null);

  async function startServerRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        mediaRef.current = null;
        setListening(false);
        if (blob.size < 1024) return toast.error("التسجيل فاضي، جرّب تاني");
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        try {
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}) as any);
          if (!res.ok || !data.text) throw new Error(data.error ?? "stt");
          setText((prev) => (prev ? `${prev} ${data.text}`.trim() : data.text));
        } catch {
          toast.error("مش قادر أفهم الصوت، جرّب تاني");
        }
      };
      mediaRef.current = { rec, chunks };
      rec.start();
      setListening(true);
    } catch {
      toast.error("مش قادر أفتح الميكروفون — اسمح بالإذن وجرّب تاني");
      setListening(false);
    }
  }

  function toggleMic() {
    if (listening) {
      if (mediaRef.current) mediaRef.current.rec.stop();
      else {
        recognitionRef.current?.stop();
        setListening(false);
      }
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return void startServerRecording();

    try {
      const rec = new SR();
      rec.lang = "ar-EG";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (ev: any) => {
        let out = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) out += ev.results[i][0].transcript;
        setText((prev) => (prev ? `${prev} ${out}`.trim() : out));
      };
      rec.onerror = () => {
        recognitionRef.current = null;
        setListening(false);
        void startServerRecording();
      };
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      void startServerRecording();
    }
  }

  /* ===== قراءة الرد بصوت عالي (متصفح أو خادم) ===== */
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopSpeaking() {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingId(null);
  }

  async function speakServer(id: string, body: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      if (!res.ok) throw new Error("tts");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setSpeakingId(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setSpeakingId(null);
      };
      setSpeakingId(id);
      await audio.play();
    } catch {
      setSpeakingId(null);
      toast.error("مش قادر أشغّل الصوت دلوقتي");
    }
  }

  function speak(id: string, body: string) {
    if (speakingId === id) return stopSpeaking();
    stopSpeaking();

    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    const arVoice = synth?.getVoices?.().find((v) => v.lang?.toLowerCase().startsWith("ar"));
    if (!synth || !arVoice) return void speakServer(id, body);

    try {
      const u = new SpeechSynthesisUtterance(body);
      u.lang = "ar-EG";
      u.voice = arVoice;
      u.rate = 1;
      u.onend = () => setSpeakingId(null);
      u.onerror = () => void speakServer(id, body);
      setSpeakingId(id);
      synth.speak(u);
    } catch {
      void speakServer(id, body);
    }
  }

  async function clearChat() {
    setMessages([]);
    setInitial([]);
    if (user?.id) await supabase.from("chat_messages" as any).delete().eq("user_id", user.id);
  }


  return (
    <>
      {!open && (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="افتح المساعد جنش"
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
          className="fixed z-40 flex items-center gap-2 rounded-full bg-primary py-2 pl-4 pr-2 text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <img
            src={janshAvatar}
            alt="جنش المساعد"
            width={512}
            height={512}
            loading="lazy"
            className="size-9 rounded-full bg-background object-contain pointer-events-none"
          />
          <span className="text-sm font-bold pointer-events-none">جنش</span>
          <GripVertical className="size-4 opacity-70 pointer-events-none" />
        </button>
      )}

      {open && (
        <div
          style={{ left: panelLeft }}
          className="fixed bottom-24 right-3 z-40 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl sm:right-auto sm:w-[380px]"
        >
          <div className="flex items-center justify-between gap-2 border-b bg-primary px-3 py-2 text-primary-foreground">
            <div className="flex items-center gap-2">
              <img
                src={janshAvatar}
                alt="جنش"
                width={512}
                height={512}
                loading="lazy"
                className="size-8 rounded-full bg-background object-contain"
              />
              <div className="leading-tight">
                <p className="text-sm font-bold">جنش</p>
                <p className="text-[11px] opacity-80">مساعد السائقين</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-primary-foreground hover:bg-primary-foreground/15"
                aria-label="محادثة جديدة"
                onClick={clearChat}
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-primary-foreground hover:bg-primary-foreground/15"
                aria-label="إغلاق"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <Conversation className="flex-1">
            <ConversationContent className="gap-3 p-3">
              {messages.length === 0 && (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    أهلاً يا ريس 👋 أنا جنش، اسألني في أي حاجة تخص العربية أو تسجيل الرحلة.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-lg border px-3 py-2 text-right text-xs hover:bg-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                const body = textOf(m);
                const img = imageOf(m);
                return (
                  <Message key={m.id} from={m.role}>
                    <MessageContent
                      className={
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent p-0 text-foreground"
                      }
                    >
                      {img && (
                        <img
                          src={img}
                          alt="صورة مرفقة"
                          className="mb-2 max-h-40 rounded-lg object-contain"
                        />
                      )}
                      {m.role === "assistant" ? (
                        <>
                          <MessageResponse>{body}</MessageResponse>
                          {body.trim() && (
                            <button
                              type="button"
                              onClick={() => speak(m.id, body)}
                              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                              aria-label="اقرأ الرد بصوت"
                            >
                              {speakingId === m.id ? (
                                <>
                                  <Square className="size-3.5" /> إيقاف
                                </>
                              ) : (
                                <>
                                  <Volume2 className="size-3.5" /> استمع
                                </>
                              )}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="whitespace-pre-wrap text-sm">{body}</span>
                      )}
                    </MessageContent>
                  </Message>
                );
              })}

              {status === "submitted" && <Shimmer className="text-sm">جنش بيفكر...</Shimmer>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t p-2">
            {image && (
              <div className="relative mb-2 inline-block">
                <img src={image} alt="مرفق" className="h-16 rounded-lg border object-cover" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -top-2 -left-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  aria-label="حذف الصورة"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            <PromptInput onSubmit={(message: PromptInputMessage) => send(message.text ?? text)}>
              <PromptInputTextarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="اكتب سؤالك لجنش..."
              />
              <PromptInputFooter className="justify-between">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickImage}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="إرفاق صورة"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={listening ? "destructive" : "ghost"}
                    aria-label="تسجيل صوتي"
                    onClick={toggleMic}
                  >
                    {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                </div>
                <PromptInputSubmit status={status} disabled={busy || (!text.trim() && !image)} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      )}
    </>
  );
}
