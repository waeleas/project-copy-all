import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, MailOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [
    { title: "الرسائل | Service Tracker Pro" },
    { name: "description", content: "رسائل وتنبيهات موظفي نظام متابعة رحلات السيارات." },
    { property: "og:title", content: "الرسائل | Service Tracker Pro" },
    { property: "og:description", content: "رسائل وتنبيهات موظفي نظام متابعة رحلات السيارات." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <AppShell>
      <Inbox />
    </AppShell>
  ),
});

function Inbox() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["messages", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_messages")
        .select("id, title, body, created_at, read_at, recipient_id")
        .or(`recipient_id.eq.${user!.id},recipient_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!data || !user?.id) return;
    // Persist broadcast reads locally (broadcasts are shared, can't per-user update in DB)
    const broadcasts = data.filter((m: any) => m.recipient_id === null);
    if (broadcasts.length) {
      const key = `msg.readBroadcasts.${user.id}`;
      let existing: string[] = [];
      try { existing = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
      const merged = Array.from(new Set([...existing, ...broadcasts.map((m: any) => m.id)]));
      localStorage.setItem(key, JSON.stringify(merged));
    }
    const unread = data.filter((m: any) => !m.read_at && m.recipient_id === user.id);
    if (unread.length > 0) {
      supabase
        .from("user_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unread.map((m: any) => m.id))
        .then(() => qc.invalidateQueries({ queryKey: ["messages-unread", user.id] }));
    } else {
      qc.invalidateQueries({ queryKey: ["messages-unread", user.id] });
    }
  }, [data, user?.id, qc]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الرسائل</h1>
      {isLoading ? (
        <Loader2 className="size-6 animate-spin mx-auto text-primary" />
      ) : (data ?? []).length === 0 ? (
        <p className="text-center text-muted-foreground py-8">لا توجد رسائل</p>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((m: any) => {
            const isBroadcast = m.recipient_id === null;
            const unread = !m.read_at && !isBroadcast;
            return (
              <Card key={m.id} className={unread ? "border-primary" : ""}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      {unread ? <Mail className="size-4 text-primary" /> : <MailOpen className="size-4 text-muted-foreground" />}
                      {m.title}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("ar-EG")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  {isBroadcast && (
                    <span className="text-xs text-muted-foreground">📢 رسالة عامة</span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
