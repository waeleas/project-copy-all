import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Loader2, MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/chats")({
  head: () => ({
    meta: [
      { title: "محادثات جنش — لوحة المدير" },
      { name: "description", content: "استعراض محادثات المساعد جنش لكل المستخدمين." },
      { property: "og:title", content: "محادثات جنش — لوحة المدير" },
      { property: "og:description", content: "استعراض محادثات المساعد جنش لكل المستخدمين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <AdminChats />
    </AppShell>
  ),
});

function AdminChats() {
  const { isAdmin, loading } = useIsAdmin();
  const [q, setQ] = useState("");
  const [openUser, setOpenUser] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-chats"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from("chat_messages" as any)
        .select("id, user_id, role, content, image_url, created_at")
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username");
      const nameOf = new Map<string, string>();
      ((profiles as any[]) ?? []).forEach((p: any) => {
        nameOf.set(p.user_id, p.display_name || p.username || String(p.user_id).slice(0, 8));
      });
      const groups = new Map<string, { name: string; items: any[] }>();
      ((msgs as any[]) ?? []).forEach((m) => {
        const g = groups.get(m.user_id) ?? { name: nameOf.get(m.user_id) ?? m.user_id.slice(0, 8), items: [] };
        g.items.push(m);
        groups.set(m.user_id, g);
      });
      return Array.from(groups.entries()).map(([user_id, g]) => ({ user_id, ...g }));
    },
  });

  const list = useMemo(() => {
    const rows = data ?? [];
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.items.some((m: any) => String(m.content ?? "").toLowerCase().includes(s)),
    );
  }, [data, q]);

  if (loading) return <Loader2 className="size-6 animate-spin text-primary" />;
  if (!isAdmin) return <p className="text-sm text-muted-foreground">هذه الصفحة للمدير فقط.</p>;

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <MessagesSquare className="size-5" /> محادثات جنش
      </h1>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المستخدم أو داخل الرسائل..." />

      {isLoading && <Loader2 className="size-6 animate-spin text-primary" />}
      {!isLoading && list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد محادثات.</p>}

      <div className="space-y-3">
        {list.map((u) => (
          <Card key={u.user_id}>
            <CardContent className="p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-right"
                onClick={() => setOpenUser(openUser === u.user_id ? null : u.user_id)}
              >
                <span className="font-bold">{u.name}</span>
                <span className="text-xs text-muted-foreground">{u.items.length} رسالة</span>
              </button>

              {openUser === u.user_id && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {u.items.map((m: any) => (
                    <div key={m.id} className={m.role === "user" ? "text-right" : "text-right"}>
                      <div
                        className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        {m.image_url && (
                          <img src={m.image_url} alt="مرفق" className="mb-1 max-h-32 rounded object-contain" />
                        )}
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("ar-EG")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
