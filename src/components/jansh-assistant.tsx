import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, RotateCcw } from "lucide-react";
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

const STORAGE_KEY = "jansh.conversation.v1";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  "إزاي أسجل قراءة العداد صح؟",
  "فحص سريع للعربية قبل ما أتحرك",
  "العربية وقفت في الطريق، أعمل إيه؟",
];

export function JanshAssistant() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [initial] = useState<UIMessage[]>(() => loadMessages());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuth();

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

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "jansh",
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: () => toast.error("معلش، حصلت مشكلة في الاتصال بجنش — جرّب تاني"),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* تخزين ممتلئ */
    }
  }, [messages]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open, status]);

  const busy = status === "submitted" || status === "streaming";

  function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setText("");
    void sendMessage({ text: trimmed }, { body: { context: ctx } });
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="افتح المساعد جنش"
          className="fixed bottom-24 left-4 z-40 flex items-center gap-2 rounded-full bg-primary py-2 pl-4 pr-2 text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <img
            src={janshAvatar}
            alt="جنش المساعد"
            width={512}
            height={512}
            loading="lazy"
            className="size-9 rounded-full bg-background object-contain"
          />
          <span className="text-sm font-bold">جنش</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 left-3 right-3 z-40 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl sm:right-auto sm:w-[380px]">
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
                onClick={() => setMessages([])}
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
                const body = m.parts
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("");
                return (
                  <Message key={m.id} from={m.role}>
                    <MessageContent
                      className={
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent p-0 text-foreground"
                      }
                    >
                      {m.role === "assistant" ? (
                        <MessageResponse>{body}</MessageResponse>
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
            <PromptInput
              onSubmit={(message: PromptInputMessage) => send(message.text ?? text)}
            >
              <PromptInputTextarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="اكتب سؤالك لجنش..."
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={busy || !text.trim()} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      )}
    </>
  );
}
