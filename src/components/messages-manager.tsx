import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { arabicError } from "@/lib/errors";
import { sendMessage, listAdminMessages, deleteMessage } from "@/lib/messages.functions";
import { listUsersWithRoles } from "@/lib/users.functions";
import { usePersistedState } from "@/hooks/use-persisted-state";

export function MessagesManager() {
  const qc = useQueryClient();
  const send = useServerFn(sendMessage);
  const listFn = useServerFn(listAdminMessages);
  const delFn = useServerFn(deleteMessage);
  const listUsers = useServerFn(listUsersWithRoles);

  const [title, setTitle] = usePersistedState("msg.title", "");
  const [body, setBody] = usePersistedState("msg.body", "");
  const [target, setTarget] = usePersistedState<string>("msg.target", "all");
  const [sending, setSending] = useState(false);

  const users = useQuery({ queryKey: ["admin-users-min"], queryFn: () => listUsers() });
  const messages = useQuery({ queryKey: ["admin-messages"], queryFn: () => listFn() });

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast.error("العنوان والنص مطلوبان");
      return;
    }
    setSending(true);
    try {
      await send({
        data: {
          title: title.trim(),
          body: body.trim(),
          recipient_id: target === "all" ? null : target,
        },
      });
      toast.success(target === "all" ? "تم إرسال الرسالة لكل المستخدمين" : "تم إرسال الرسالة");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-messages"] });
    } catch (e: any) {
      toast.error("فشل الإرسال: " + arabicError(e));
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف الرسالة؟")) return;
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-messages"] });
      toast.success("تم الحذف");
    } catch (e: any) {
      toast.error("فشل الحذف: " + arabicError(e));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إرسال رسالة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>المستقبل</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📢 كل المستخدمين</SelectItem>
                {(users.data ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name || u.username || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>النص</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} />
          </div>
          <Button onClick={submit} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            إرسال
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الرسائل المرسلة</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.isLoading ? (
            <Loader2 className="size-6 animate-spin mx-auto text-primary" />
          ) : (messages.data ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-4">لا توجد رسائل</p>
          ) : (
            <div className="space-y-2">
              {(messages.data ?? []).map((m: any) => (
                <div key={m.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{m.body}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {m.recipient_id ? `→ ${m.recipient_name}` : "📢 لكل المستخدمين"} ·{" "}
                      {new Date(m.created_at).toLocaleString("ar-EG")}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
