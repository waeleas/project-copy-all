import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { arabicError } from "@/lib/errors";

const USERNAME_DOMAIN = "app.local";

function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, display_name, must_change_password, rental_cars_override, trip_create_override");

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const profByUser = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profByUser.set(p.user_id, p));

    return users.users.map((u) => {
      const p = profByUser.get(u.id) ?? {};
      return {
        id: u.id,
        email: u.email ?? "",
        username: p.username ?? null,
        display_name: p.display_name ?? null,
        must_change_password: !!p.must_change_password,
        rental_cars_override: p.rental_cars_override ?? null,
        trip_create_override: p.trip_create_override ?? null,
        created_at: u.created_at,
        last_sign_in_at: (u as any).last_sign_in_at ?? null,
        roles: rolesByUser.get(u.id) ?? ["user"],
      };
    });
  });


const setRoleSchema = z.object({
  user_id: z.string().uuid(),
  is_admin: z.boolean(),
});

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.is_admin) {
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: "admin" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
    }
    return { ok: true };
  });

const setViewerSchema = z.object({
  user_id: z.string().uuid(),
  is_viewer: z.boolean(),
});

export const setUserViewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setViewerSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.is_viewer) {
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: "viewer" as any });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "viewer" as any);
    }
    return { ok: true };
  });

const usernameRegex = /^[a-zA-Z0-9._-]{3,40}$/;

const createUserSchema = z.object({
  username: z.string().trim().regex(usernameRegex, "اسم المستخدم غير صالح"),
  display_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().optional().or(z.literal("")),
  is_admin: z.boolean().default(false),
});

/** Random strong initial password; new users set their own via first-time setup. */
function randomInitialPassword() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "Tmp!" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isWeakPasswordError(error: unknown) {
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  return /weak|pwned|known to be|easy to guess/i.test(message);
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const username = data.username.toLowerCase();
    const email = data.email && data.email.length > 0 ? data.email : usernameToEmail(username);

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("username", username)
      .maybeSingle();
    if (existing) throw new Error("اسم المستخدم مستخدم بالفعل");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomInitialPassword(),
      email_confirm: true,
      user_metadata: { username, display_name: data.display_name },
    });
    if (error) throw error;

    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "user" });
    if (data.is_admin) {
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    }

    // upsert profile (trigger may have created one)
    await supabaseAdmin.from("profiles").upsert(
      {
        user_id: created.user.id,
        username,
        display_name: data.display_name,
        must_change_password: true,
      },
      { onConflict: "user_id" }
    );

    return { ok: true, id: created.user.id };
  });

const deleteUserSchema = z.object({ user_id: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("لا يمكنك حذف حسابك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });

const updatePasswordSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(6).max(200),
});

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updatePasswordSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (isWeakPasswordError(error)) {
      throw new Error("كلمة المرور ضعيفة أو مستخدمة كثيرًا، اختر كلمة أقوى تحتوي على أحرف وأرقام ورموز");
    }
    if (error) throw error;
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", data.user_id);
    return { ok: true };
  });

// ===== Public (unauthenticated) helpers for login =====

const usernameLookupSchema = z.object({
  username: z.string().trim().min(1).max(100),
});

/** Resolves a username to its login email. Public — used by the sign-in form. */
export const resolveUsernameToEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => usernameLookupSchema.parse(d))
  .handler(async ({ data }) => {
    try {
    const username = data.username.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, must_change_password")
      .ilike("username", username)
      .maybeSingle();
    if (profErr) throw profErr;
    if (!prof) return { email: null, must_change_password: false, reason: "username_missing" as const, error_message: null };
    const { data: u, error: userErr } = await supabaseAdmin.auth.admin.getUserById(prof.user_id);
    if (userErr && userErr.status !== 404) throw userErr;
    return {
      error_message: null,
      reason: u?.user?.email ? null : ("account_missing" as const),
      email: u?.user?.email ?? null,
      must_change_password: !!prof.must_change_password,
    };
    } catch (error) {
      // Return a safe plain result: production may redact thrown error details.
      return {
        email: null,
        must_change_password: false,
        reason: "lookup_failed" as const,
        error_message: arabicError(error, "تعذر التحقق من اسم المستخدم لدى خدمة الحسابات؛ لم يتوفر سبب محدد، حاول مجددًا"),
      };
    }
  });

const firstTimeSchema = z.object({
  username: z.string().trim().min(1),
  new_password: z.string().min(6).max(200),
});

/**
 * First-time password setup. Only succeeds if the profile is flagged
 * must_change_password=true. Returns the email so the client can sign in.
 */
export const firstTimeSetPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => firstTimeSchema.parse(d))
  .handler(async ({ data }) => {
    const username = data.username.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("user_id, must_change_password")
      .ilike("username", username)
      .maybeSingle();
    if (!prof) throw new Error("اسم المستخدم غير موجود");
    if (!prof.must_change_password) {
      throw new Error("هذا الحساب لديه كلمة مرور بالفعل، سجل الدخول بشكل عادي");
    }
    const { data: u, error: getErr } = await supabaseAdmin.auth.admin.getUserById(prof.user_id);
    if (getErr || !u.user) throw new Error("تعذر العثور على الحساب");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(prof.user_id, {
      password: data.new_password,
    });
    if (isWeakPasswordError(updErr)) {
      return {
        email: "",
        error: "weak_password",
        message: "كلمة المرور ضعيفة أو مستخدمة كثيرًا، اختر كلمة أقوى تحتوي على أحرف وأرقام ورموز",
      };
    }
    if (updErr) throw updErr;

    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", prof.user_id);

    return { email: u.user.email ?? "", error: null, message: null };
  });

// ===== Create user accounts for drivers =====

function driverUsername(d: { id: string; sap_number: string | null; name: string }) {
  const sap = (d.sap_number ?? "").trim();
  if (sap && /^[a-zA-Z0-9._-]{3,40}$/.test(sap)) return sap.toLowerCase();
  return `driver_${d.id.slice(0, 8)}`.toLowerCase();
}

export const createUsersForAllDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: drivers, error } = await supabaseAdmin
      .from("drivers")
      .select("id, name, sap_number");
    if (error) throw error;

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const d of drivers ?? []) {
      const username = driverUsername(d as any);
      const email = usernameToEmail(username);

      const { data: exists } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .ilike("username", username)
        .maybeSingle();
      if (exists) { skipped++; continue; }

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomInitialPassword(),
        email_confirm: true,
        user_metadata: { username, display_name: d.name },
      });
      if (createErr || !newUser?.user) {
        errors.push(`${d.name}: ${createErr?.message ?? "فشل"}`);
        continue;
      }
      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "user" });
      await supabaseAdmin.from("profiles").upsert(
        {
          user_id: newUser.user.id,
          username,
          display_name: d.name,
          must_change_password: true,
        },
        { onConflict: "user_id" }
      );
      created++;
    }

    return { created, skipped, errors };
  });

// ===== App settings & per-user overrides =====

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("rental_cars_visible, trip_creation_enabled")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    return {
      rental_cars_visible: data?.rental_cars_visible ?? true,
      trip_creation_enabled: data?.trip_creation_enabled ?? true,
    };
  });

const updateSettingsSchema = z.object({
  rental_cars_visible: z.boolean().optional(),
  trip_creation_enabled: z.boolean().optional(),
});

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = { id: true, updated_at: new Date().toISOString() };
    if (typeof data.rental_cars_visible === "boolean") payload.rental_cars_visible = data.rental_cars_visible;
    if (typeof data.trip_creation_enabled === "boolean") payload.trip_creation_enabled = data.trip_creation_enabled;
    const { error } = await supabaseAdmin.from("app_settings").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    return { ok: true };
  });

const overrideSchema = z.object({
  user_id: z.string().uuid(),
  key: z.enum(["rental_cars_override", "trip_create_override"]),
  value: z.union([z.boolean(), z.null()]),
});

export const setUserOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => overrideSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { [data.key]: data.value };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });
