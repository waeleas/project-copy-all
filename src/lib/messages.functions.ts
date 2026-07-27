import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

const sendSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  recipient_id: z.string().uuid().nullable().optional(),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("user_messages").insert({
      sender_id: context.userId,
      recipient_id: data.recipient_id ?? null,
      title: data.title,
      body: data.body,
    });
    if (error) throw error;
    return { ok: true };
  });

export const listAdminMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_messages")
      .select("id, title, body, recipient_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const recipientIds = Array.from(
      new Set((data ?? []).map((m: any) => m.recipient_id).filter(Boolean)),
    );
    let profByUser = new Map<string, string>();
    if (recipientIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", recipientIds as string[]);
      (profs ?? []).forEach((p: any) =>
        profByUser.set(p.user_id, p.display_name || p.username || p.user_id),
      );
    }

    return (data ?? []).map((m: any) => ({
      ...m,
      recipient_name: m.recipient_id ? profByUser.get(m.recipient_id) ?? "مستخدم" : null,
    }));
  });

const deleteSchema = z.object({ id: z.string().uuid() });
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("user_messages").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
