import { arabicError } from "@/lib/errors";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Shield, UserPlus } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { listUsersWithRoles, setUserAdmin, setUserViewer, createUser, deleteUser, updateUserPassword, createUsersForAllDrivers, getAppSettings, updateAppSettings, setUserOverride } from "@/lib/users.functions";
import { Switch } from "@/components/ui/switch";
import { Select as UiSelect, SelectContent as UiSelectContent, SelectItem as UiSelectItem, SelectTrigger as UiSelectTrigger, SelectValue as UiSelectValue } from "@/components/ui/select";
import { Car as CarIcon, ListChecks, Users as UsersIcon, ShieldCheck, Eye, Ban } from "lucide-react";
import { DataToolbar, exportToXlsx, pick } from "@/components/data-toolbar";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { BackupButton } from "@/components/backup-button";
import { RestoreButton } from "@/components/restore-button";
import { MessagesManager } from "@/components/messages-manager";


export const Route = createFileRoute("/manage")({
  head: () => ({ meta: [{ title: "البيانات الأساسية" }] }),
  component: () => <AppShell><Manage /></AppShell>,
});

function Manage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = usePersistedState("manage.tab", "users");




  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("هذه الصفحة للأدمن فقط");
      navigate({ to: "/" });
    }
  }, [loading, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return <div className="text-center py-12"><Loader2 className="size-8 mx-auto animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">البيانات الأساسية</h1>
          <p className="text-sm text-muted-foreground">إدارة المكاتب ومتلقي الخدمة أو فنى والسائقين والمستخدمين</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BackupButton />
          <RestoreButton />
        </div>
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-9 w-full h-auto">
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="messages">الرسائل</TabsTrigger>
          <TabsTrigger value="offices">المكاتب</TabsTrigger>
          <TabsTrigger value="managers">المديرون</TabsTrigger>
          <TabsTrigger value="technicians">متلقي الخدمة أو فنى</TabsTrigger>
          <TabsTrigger value="drivers">السائقون</TabsTrigger>
          <TabsTrigger value="cars">السيارات</TabsTrigger>
          <TabsTrigger value="services">الخدمات</TabsTrigger>
          <TabsTrigger value="governorates">المحافظات</TabsTrigger>
        </TabsList>


        <TabsContent value="users"><UsersManager /></TabsContent>
        <TabsContent value="messages"><MessagesManager /></TabsContent>
        <TabsContent value="offices"><LookupManager table="offices" title="المكاتب" withCode /></TabsContent>
        <TabsContent value="managers"><LookupManager table="managers" title="المديرون" withSap withCostCenter /></TabsContent>
        <TabsContent value="technicians"><LookupManager table="technicians" title="متلقي الخدمة أو فنى" withSap /></TabsContent>

        <TabsContent value="drivers"><DriversManager /></TabsContent>
        <TabsContent value="cars"><CarsManager /></TabsContent>
        <TabsContent value="services"><LookupManager table="service_types" title="أنواع الخدمة" /></TabsContent>
        <TabsContent value="governorates"><LookupManager table="governorates" title="المحافظات" withCode /></TabsContent>
      </Tabs>
    </div>
  );
}


function AppSettingsCard() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getAppSettings);
  const updateSettings = useServerFn(updateAppSettings);
  const { data: settings, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => getSettings(),
  });

  async function toggle(key: "rental_cars_visible" | "trip_creation_enabled", value: boolean) {
    try {
      await updateSettings({ data: { [key]: value } as any });
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      qc.invalidateQueries({ queryKey: ["cars"] });
      toast.success("تم حفظ الإعداد");
    } catch (e: any) {
      toast.error(e.message ?? "فشل");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="size-4" /> الإعدادات العامة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-2 min-w-0">
                <CarIcon className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">إظهار سيارات الإيجار للجميع</div>
                  <div className="text-xs text-muted-foreground">يمكن استثناء مستخدمين محددين من القائمة أدناه.</div>
                </div>
              </div>
              <Switch
                checked={!!settings?.rental_cars_visible}
                onCheckedChange={(v) => toggle("rental_cars_visible", v)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-2 min-w-0">
                <ListChecks className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">السماح بتسجيل الرحلات للجميع</div>
                  <div className="text-xs text-muted-foreground">إغلاق هذا المفتاح يمنع كل المستخدمين إلا الاستثناءات والمشرفين.</div>
                </div>
              </div>
              <Switch
                checked={!!settings?.trip_creation_enabled}
                onCheckedChange={(v) => toggle("trip_creation_enabled", v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={!settings?.trip_creation_enabled}
                onClick={() => toggle("trip_creation_enabled", false)}
              >
                <Ban className="size-4 ml-1" /> منع الكل من تسجيل الرحلات
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!settings?.rental_cars_visible}
                onClick={() => toggle("rental_cars_visible", false)}
              >
                <Ban className="size-4 ml-1" /> إخفاء سيارات الإيجار عن الكل
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!!settings?.trip_creation_enabled}
                onClick={() => toggle("trip_creation_enabled", true)}
              >
                <ListChecks className="size-4 ml-1" /> السماح للكل بتسجيل الرحلات
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!!settings?.rental_cars_visible}
                onClick={() => toggle("rental_cars_visible", true)}
              >
                <CarIcon className="size-4 ml-1" /> إظهار سيارات الإيجار للكل
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OverrideSelect({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  const str = value === null ? "default" : value ? "allow" : "deny";
  return (
    <UiSelect
      value={str}
      onValueChange={(v) => onChange(v === "default" ? null : v === "allow")}
      disabled={disabled}
    >
      <UiSelectTrigger className="h-8 w-[130px] text-xs">
        <UiSelectValue />
      </UiSelectTrigger>
      <UiSelectContent>
        <UiSelectItem value="default">حسب الإعداد العام</UiSelectItem>
        <UiSelectItem value="allow">مسموح</UiSelectItem>
        <UiSelectItem value="deny">ممنوع</UiSelectItem>
      </UiSelectContent>
    </UiSelect>
  );
}

function UsersManager() {
  const qc = useQueryClient();
  const list = useServerFn(listUsersWithRoles);
  const setAdmin = useServerFn(setUserAdmin);
  const setViewer = useServerFn(setUserViewer);
  const setOverride = useServerFn(setUserOverride);
  const create = useServerFn(createUser);
  const remove = useServerFn(deleteUser);
  const changePassword = useServerFn(updateUserPassword);

  const { data: users, isLoading, isFetching } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: () => list(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const [username, setUsername] = usePersistedState("users.username", "");
  const [displayName, setDisplayName] = usePersistedState("users.display_name", "");
  const [email, setEmail] = usePersistedState<string>("users.email", "");
  const [makeAdmin, setMakeAdmin] = usePersistedState<boolean>("users.make_admin", false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = usePersistedState<"all" | "admin" | "viewer" | "user">("users.filter", "all");
  const [usageFilter, setUsageFilter] = usePersistedState<"all" | "used" | "never">("users.usage", "all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const allUsers = users ?? [];
  const stats = {
    total: allUsers.length,
    admins: allUsers.filter((u: any) => u.roles.includes("admin")).length,
    used: allUsers.filter((u: any) => !!u.last_sign_in_at).length,
    never: allUsers.filter((u: any) => !u.last_sign_in_at).length,
  };

  const filteredUsers = allUsers.filter((u: any) => {
    if (roleFilter === "admin" && !u.roles.includes("admin")) return false;
    if (roleFilter === "viewer" && !u.roles.includes("viewer")) return false;
    if (roleFilter === "user" && (u.roles.includes("admin") || u.roles.includes("viewer"))) return false;
    if (usageFilter === "used" && !u.last_sign_in_at) return false;
    if (usageFilter === "never" && u.last_sign_in_at) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [u.username, u.display_name, u.email].some((v) => (v ?? "").toString().toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, roleFilter, usageFilter]);

  function formatLastSignIn(iso: string | null): string {
    if (!iso) return "لم يستخدم";
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const day = 86400000;
    if (diffMs < day) return "اليوم";
    if (diffMs < 2 * day) return "أمس";
    if (diffMs < 30 * day) return `منذ ${Math.floor(diffMs / day)} يوم`;
    return d.toLocaleDateString("ar-EG");
  }

  async function importUsers(rows: any[]) {
    let ok = 0, fail = 0;
    for (const r of rows) {
      const u = pick(r, "username", "اليوزر", "اسم المستخدم");
      const d = pick(r, "display_name", "الاسم", "الاسم الكامل");
      if (!u || !d) { fail++; continue; }
      try {
        await create({ data: { username: u, display_name: d, email: pick(r, "email", "البريد") || undefined, is_admin: /^(1|true|yes|نعم)$/i.test(pick(r, "is_admin", "أدمن")) } });
        ok++;
      } catch { fail++; }
    }
    qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    toast.success(`تم إضافة ${ok} مستخدم${fail ? ` — فشل ${fail}` : ""}`);
  }

  async function add() {
    if (!username.trim() || !displayName.trim()) return toast.error("اسم المستخدم والاسم مطلوبان");
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username.trim())) return toast.error("اسم المستخدم: أحرف إنجليزية وأرقام فقط (3-40)");
    setSaving(true);
    try {
      await create({
        data: {
          username: username.trim(),
          display_name: displayName.trim(),
          email: email.trim() || undefined,
          is_admin: makeAdmin,
        },
      });
      setUsername(""); setDisplayName(""); setEmail(""); setMakeAdmin(false);
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("تم إنشاء المستخدم");
    } catch (e: any) {
      toast.error(e.message ?? "فشل");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(u: any) {
    const isAdmin = u.roles.includes("admin");
    try {
      await setAdmin({ data: { user_id: u.id, is_admin: !isAdmin } });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (e: any) { toast.error(e.message ?? "فشل"); }
  }

  async function toggleViewer(u: any) {
    const isViewer = u.roles.includes("viewer");
    try {
      await setViewer({ data: { user_id: u.id, is_viewer: !isViewer } });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (e: any) { toast.error(e.message ?? "فشل"); }
  }

  async function changeOverride(u: any, key: "rental_cars_override" | "trip_create_override", value: boolean | null) {
    try {
      await setOverride({ data: { user_id: u.id, key, value } });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("تم الحفظ");
    } catch (e: any) { toast.error(e.message ?? "فشل"); }
  }

  async function del(u: any) {
    if (!confirm(`حذف ${u.username ?? u.email}؟`)) return;
    try {
      await remove({ data: { user_id: u.id } });
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("تم الحذف");
    } catch (e: any) { toast.error(e.message ?? "فشل"); }
  }

  async function changePwd(u: any) {
    const pwd = prompt(`كلمة المرور الجديدة للمستخدم ${u.username ?? u.email} (6 أحرف على الأقل):`);
    if (!pwd) return;
    if (pwd.length < 6) return toast.error("كلمة المرور قصيرة جداً");
    try {
      await changePassword({ data: { user_id: u.id, password: pwd } });
      toast.success("تم تغيير كلمة المرور");
    } catch (e: any) { toast.error(e.message ?? "فشل"); }
  }

  return (
    <div className="mt-4 space-y-4">
      <AppSettingsCard />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile icon={UsersIcon} label="إجمالي المستخدمين" value={stats.total} tone="primary" />
        <StatTile icon={ShieldCheck} label="المشرفون" value={stats.admins} tone="green" />
        <StatTile icon={Eye} label="استخدموا الحساب" value={stats.used} tone="green" />
        <StatTile icon={Ban} label="لم يستخدموا الحساب" value={stats.never} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="size-4" /> إضافة مستخدم جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">اسم المستخدم (يوزر)</Label>
              <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmed.ali" />
            </div>
            <div className="space-y-1"><Label className="text-xs">الاسم الكامل</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="أحمد علي" />
            </div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">البريد الإلكتروني (اختياري)</Label>
              <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="اتركه فارغًا لتوليده تلقائيًا" />
            </div>
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
                صلاحية أدمن
              </label>
              <Button onClick={add} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                إضافة مستخدم
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="size-4" /> قائمة المستخدمين
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1">
              <DataToolbar
                search={search}
                onSearch={setSearch}
                onExport={() => exportToXlsx("users.xlsx", allUsers.map((u: any) => ({
                  "اسم المستخدم": u.username ?? "",
                  "الاسم": u.display_name ?? "",
                  "البريد": u.email ?? "",
                  "استخدم اليوزر؟": u.last_sign_in_at ? "نعم" : "لا",
                  "آخر دخول": u.last_sign_in_at ? formatLastSignIn(u.last_sign_in_at) : "لم يسجّل الدخول",
                  "الدور": u.roles.includes("admin") ? "مشرف" : u.roles.includes("viewer") ? "اطّلاع" : "مستخدم",
                  "سيارات الإيجار": u.rental_cars_override === null ? "افتراضي" : u.rental_cars_override ? "مسموح" : "ممنوع",
                  "إنشاء الطلبات": u.trip_create_override === null ? "افتراضي" : u.trip_create_override ? "مسموح" : "ممنوع",
                })), "تقرير المستخدمين")}
                onImportRows={importUsers}
                placeholder="بحث بالاسم أو اليوزر..."
              />
            </div>
            <UiSelect value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
              <UiSelectTrigger className="w-full sm:w-[160px]"><UiSelectValue /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="all">كل الأدوار</UiSelectItem>
                <UiSelectItem value="admin">المشرفون فقط</UiSelectItem>
                <UiSelectItem value="viewer">المطّلعون فقط</UiSelectItem>
                <UiSelectItem value="user">مستخدمون عاديون</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
            <UiSelect value={usageFilter} onValueChange={(v: any) => setUsageFilter(v)}>
              <UiSelectTrigger className="w-full sm:w-[170px]"><UiSelectValue /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="all">الكل (استخدم/لم يستخدم)</UiSelectItem>
                <UiSelectItem value="used">استخدم الحساب</UiSelectItem>
                <UiSelectItem value="never">لم يستخدم بعد</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          {(isLoading || isFetching) && <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>}

          <div className="text-xs text-muted-foreground">
            عرض {pagedUsers.length} من {filteredUsers.length} (الإجمالي {allUsers.length})
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr className="[&>th]:p-2 [&>th]:text-right">
                  <th>المستخدم</th>
                  <th className="w-[140px]">آخر دخول</th>
                  <th className="w-[110px]">الدور</th>
                  <th className="w-[150px]">سيارات الإيجار</th>
                  <th className="w-[150px]">تسجيل الرحلات</th>
                  <th className="w-[240px]">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((u: any) => {
                  const isAdmin = u.roles.includes("admin");
                  const isViewer = u.roles.includes("viewer");
                  const used = !!u.last_sign_in_at;
                  return (
                    <tr key={u.id} className="border-t align-middle [&>td]:p-2">
                      <td>
                        <div className="font-medium truncate">{u.display_name ?? u.username ?? u.email}</div>
                        <div className="text-xs text-muted-foreground truncate" dir="ltr">@{u.username ?? "—"}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {isAdmin && <Badge className="bg-primary text-xs"><Shield className="size-3 ml-1" /> أدمن</Badge>}
                          {isViewer && <Badge className="bg-blue-600 hover:bg-blue-600 text-xs"><Eye className="size-3 ml-1" /> مطّلع</Badge>}
                          {!isAdmin && !isViewer && <Badge variant="secondary" className="text-xs">مستخدم</Badge>}
                          {u.must_change_password && <Badge variant="outline" className="text-xs">بدون كلمة مرور</Badge>}
                        </div>
                      </td>
                      <td>
                        {used ? (
                          <div>
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">استخدم</Badge>
                            <div className="text-xs text-muted-foreground mt-1">{formatLastSignIn(u.last_sign_in_at)}</div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">لم يستخدم</Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-1 text-xs">
                            <Switch checked={isAdmin} onCheckedChange={() => toggle(u)} /> أدمن
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <Switch checked={isViewer} onCheckedChange={() => toggleViewer(u)} /> مطّلع
                          </label>
                        </div>
                      </td>
                      <td>
                        <OverrideSelect
                          value={u.rental_cars_override}
                          disabled={isAdmin}
                          onChange={(v) => changeOverride(u, "rental_cars_override", v)}
                        />
                      </td>
                      <td>
                        <OverrideSelect
                          value={u.trip_create_override}
                          disabled={isAdmin}
                          onChange={(v) => changeOverride(u, "trip_create_override", v)}
                        />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => changePwd(u)}>كلمة المرور</Button>
                          <Button size="sm" variant="ghost" onClick={() => del(u)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {pagedUsers.map((u: any) => {
              const isAdmin = u.roles.includes("admin");
              const isViewer = u.roles.includes("viewer");
              const used = !!u.last_sign_in_at;
              return (
                <div key={u.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.display_name ?? u.username ?? u.email}</div>
                      <div className="text-xs text-muted-foreground truncate" dir="ltr">@{u.username ?? "—"}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isAdmin && <Badge className="bg-primary text-xs"><Shield className="size-3 ml-1" /> أدمن</Badge>}
                        {isViewer && <Badge className="bg-blue-600 hover:bg-blue-600 text-xs">مطّلع</Badge>}
                        {!isAdmin && !isViewer && <Badge variant="secondary" className="text-xs">مستخدم</Badge>}
                        {used ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">استخدم — {formatLastSignIn(u.last_sign_in_at)}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">لم يستخدم</Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => del(u)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center justify-between gap-1 rounded border p-2">
                      أدمن <Switch checked={isAdmin} onCheckedChange={() => toggle(u)} />
                    </label>
                    <label className="flex items-center justify-between gap-1 rounded border p-2">
                      مطّلع <Switch checked={isViewer} onCheckedChange={() => toggleViewer(u)} />
                    </label>
                    <div className="rounded border p-2">
                      <div className="mb-1 text-muted-foreground">سيارات الإيجار</div>
                      <OverrideSelect
                        value={u.rental_cars_override}
                        disabled={isAdmin}
                        onChange={(v) => changeOverride(u, "rental_cars_override", v)}
                      />
                    </div>
                    <div className="rounded border p-2">
                      <div className="mb-1 text-muted-foreground">تسجيل الرحلات</div>
                      <OverrideSelect
                        value={u.trip_create_override}
                        disabled={isAdmin}
                        onChange={(v) => changeOverride(u, "trip_create_override", v)}
                      />
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => changePwd(u)}>
                    تغيير كلمة المرور
                  </Button>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>السابق</Button>
              <div className="text-xs text-muted-foreground">صفحة {currentPage} من {totalPages}</div>
              <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>التالي</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "primary" | "green" | "amber" | "rose" }) {
  const bg =
    tone === "primary" ? "bg-primary/10 text-primary" :
    tone === "green" ? "bg-emerald-100 text-emerald-700" :
    tone === "amber" ? "bg-amber-100 text-amber-700" :
    "bg-rose-100 text-rose-700";
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <div className={`size-10 rounded-lg flex items-center justify-center ${bg}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}



function DriversManager() {
  const qc = useQueryClient();
  const [name, setName] = usePersistedState("drivers.name", "");
  const [sap, setSap] = usePersistedState("drivers.sap", "");
  const [type, setType] = usePersistedState<"company" | "rental">("drivers.type", "company");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [creatingUsers, setCreatingUsers] = useState(false);
  const createDriverUsers = useServerFn(createUsersForAllDrivers);

  async function generateUsers() {
    if (!confirm("سيتم إنشاء حساب مستخدم لكل سائق ليس لديه حساب (كلمة السر 123456). متابعة؟")) return;
    setCreatingUsers(true);
    try {
      const res: any = await createDriverUsers({});
      const msg = `تم إنشاء ${res.created} حساب، تم تخطي ${res.skipped}` + (res.errors?.length ? ` — أخطاء: ${res.errors.length}` : "");
      if (res.errors?.length) toast.warning(msg); else toast.success(msg);
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (e: any) {
      toast.error(arabicError(e));
    } finally {
      setCreatingUsers(false);
    }
  }


  const { data, isLoading } = useQuery({
    queryKey: ["drivers", type],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers" as any).select("*").eq("type", type).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  async function importDrivers(rows: any[]) {
    const payload = rows.map((r) => {
      const name = pick(r, "name", "اسم السائق", "الاسم");
      const sap_number = pick(r, "sap_number", "sap", "رقم الساب", "ساب");
      const t = pick(r, "type", "النوع").toLowerCase();
      const rowType = t === "rental" || t.includes("إيجار") || t.includes("ايجار") ? "rental" : (t === "company" || t.includes("شركة")) ? "company" : type;
      return name ? { name, type: rowType, sap_number: rowType === "company" ? (sap_number || null) : null } : null;
    }).filter(Boolean) as any[];
    if (!payload.length) return toast.error("لا توجد صفوف صالحة");
    const { error } = await supabase.from("drivers" as any).insert(payload);
    if (error) return toast.error(arabicError(error));
    qc.invalidateQueries({ queryKey: ["drivers"] });
    toast.success(`تم استيراد ${payload.length}`);
  }

  const filtered = (data ?? []).filter((d: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [d.name, d.sap_number].some((v) => (v ?? "").toString().toLowerCase().includes(q));
  });

  async function add() {
    if (!name.trim()) return toast.error("اسم السائق مطلوب");
    if (type === "company" && !sap.trim()) return toast.error("رقم الساب مطلوب لسائقي الشركة");
    setSaving(true);
    const payload: any = { name: name.trim(), type, sap_number: type === "company" ? sap.trim() : null };
    const { error } = await supabase.from("drivers" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(arabicError(error));
    setName(""); setSap("");
    qc.invalidateQueries({ queryKey: ["drivers"] });
    toast.success("تمت الإضافة");
  }

  async function remove(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const { error } = await supabase.from("drivers" as any).delete().eq("id", id);
    if (error) return toast.error(arabicError(error));
    qc.invalidateQueries({ queryKey: ["drivers"] });
    toast.success("تم الحذف");
  }

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-base">السائقون</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <Button type="button" variant={type === "company" ? "default" : "outline"} onClick={() => setType("company")}>شركة</Button>
            <Button type="button" variant={type === "rental" ? "default" : "outline"} onClick={() => setType("rental")}>إيجار</Button>
        </div>

        <Button type="button" variant="outline" onClick={generateUsers} disabled={creatingUsers} className="w-full">
          {creatingUsers ? <Loader2 className="size-4 animate-spin ml-2" /> : <UserPlus className="size-4 ml-2" />}
          إنشاء حسابات مستخدمين للسائقين (كلمة السر 123456)
        </Button>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input placeholder="اسم السائق" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder={type === "company" ? "رقم الساب" : "بدون ساب (إيجار)"} value={sap} onChange={(e) => setSap(e.target.value)} disabled={type === "rental"} dir="ltr" />
            <Button onClick={add} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
        </div>

        <DataToolbar
          search={search}
          onSearch={setSearch}
          onExport={() => exportToXlsx(`drivers-${type}.xlsx`, (data ?? []).map((d: any) => ({ name: d.name, sap_number: d.sap_number, type: d.type })))}
          onImportRows={importDrivers}
          placeholder="بحث بالاسم أو الساب..."
        />

        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>}
          {filtered.length === 0 && !isLoading && <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سائقون</p>}
          {filtered.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between bg-muted/50 rounded-md p-2.5">
              <div className="text-sm">
                <div className="font-medium">{d.name}</div>
                {d.sap_number && <div className="text-xs text-muted-foreground" dir="ltr">ساب: {d.sap_number}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(d.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CarsManager() {
  const qc = useQueryClient();
  const [code, setCode] = usePersistedState("cars.code", "");
  const [handheldCode, setHandheldCode] = usePersistedState("cars.handheld_code", "");
  const [plate, setPlate] = usePersistedState("cars.plate", "");
  const [type, setType] = usePersistedState<"company" | "rental">("cars.type", "company");
  const [routeCode, setRouteCode] = usePersistedState("cars.route_code", "");
  const [routeDescription, setRouteDescription] = usePersistedState("cars.route_description", "");
  const [description, setDescription] = usePersistedState("cars.description", "");
  const [followOfficeId, setFollowOfficeId] = usePersistedState("cars.follow_office_id", "");
  const filter = type;
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");


  const offices = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("offices" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cars", filter],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars" as any).select("*, follow_office:offices!cars_follow_office_id_fkey(name)").eq("type", filter).order("code", { nullsFirst: false }).order("plate");
      if (error) throw error;
      return data as any[];
    },
  });

  async function add() {
    if (!plate.trim()) return toast.error("رقم اللوحة مطلوب");
    if (type === "company" && !code.trim()) return toast.error("كود السيارة مطلوب لسيارات الشركة");
    setSaving(true);
    const payload: any = { plate: plate.trim(), type, description: description.trim() || null };
    if (type === "company") payload.code = code.trim();
    if (type === "rental") {
      payload.handheld_code = handheldCode.trim() || null;
      payload.route_code = routeCode.trim() || null;
      payload.route_description = routeDescription.trim() || null;
      payload.follow_office_id = followOfficeId || null;
    }
    const { error } = await supabase.from("cars" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(arabicError(error));
    setCode(""); setPlate(""); setHandheldCode(""); setRouteCode(""); setRouteDescription(""); setDescription(""); setFollowOfficeId("");
    qc.invalidateQueries({ queryKey: ["cars"] });
    toast.success("تمت الإضافة");
  }

  async function remove(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const { error } = await supabase.from("cars" as any).delete().eq("id", id);
    if (error) return toast.error(arabicError(error));
    qc.invalidateQueries({ queryKey: ["cars"] });
    toast.success("تم الحذف");
  }

  async function saveEdit() {
    if (!editing) return;
    const payload: any = {
      plate: (editing.plate ?? "").trim() || null,
      description: (editing.description ?? "").trim() || null,
    };
    if (editing.type === "company") {
      payload.code = (editing.code ?? "").trim() || null;
    } else {
      payload.handheld_code = (editing.handheld_code ?? "").trim() || null;
      payload.route_code = (editing.route_code ?? "").trim() || null;
      payload.route_description = (editing.route_description ?? "").trim() || null;
      payload.follow_office_id = editing.follow_office_id || null;
    }
    const { error } = await supabase.from("cars" as any).update(payload).eq("id", editing.id);
    if (error) return toast.error(arabicError(error));
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["cars"] });
    toast.success("تم الحفظ");
  }

  async function importCars(rows: any[]) {
    const officeByName = new Map<string, string>();
    (offices.data ?? []).forEach((o: any) => officeByName.set((o.name ?? "").toString().trim().toLowerCase(), o.id));
    const payload = rows.map((r) => {
      const plate = pick(r, "plate", "رقم اللوحة", "اللوحة");
      const t = pick(r, "type", "النوع").toLowerCase();
      const rowType = t === "rental" || t.includes("إيجار") || t.includes("ايجار") ? "rental" : (t === "company" || t.includes("شركة")) ? "company" : type;
      if (!plate) return null;
      const description = pick(r, "description", "الوصف", "وصف السيارة") || null;
      if (rowType === "company") {
        const code = pick(r, "code", "كود السيارة", "الكود");
        return { plate, type: "company", code: code || null, description };
      }
      const officeName = pick(r, "office", "المكتب", "تابع", "follow_office");
      return {
        plate,
        type: "rental",
        handheld_code: pick(r, "handheld_code", "كود الهاند هيلد") || null,
        route_code: pick(r, "route_code", "كود خط السير") || null,
        route_description: pick(r, "route_description", "وصف خط السير") || null,
        follow_office_id: officeName ? (officeByName.get(officeName.toLowerCase()) ?? null) : null,
        description,
      };
    }).filter(Boolean) as any[];
    if (!payload.length) return toast.error("لا توجد صفوف صالحة");
    const { error } = await supabase.from("cars" as any).insert(payload);
    if (error) return toast.error(arabicError(error));
    qc.invalidateQueries({ queryKey: ["cars"] });
    toast.success(`تم استيراد ${payload.length}`);
  }

  const filtered = (data ?? []).filter((c: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [c.code, c.plate, c.handheld_code, c.route_code, c.route_description, c.description, c.follow_office?.name].some((v) => (v ?? "").toString().toLowerCase().includes(q));
  });


  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-base">السيارات</CardTitle></CardHeader>
      <CardContent className="space-y-4">

        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <Button type="button" variant={type === "company" ? "default" : "outline"} onClick={() => setType("company")}>شركة</Button>
            <Button type="button" variant={type === "rental" ? "default" : "outline"} onClick={() => setType("rental")}>إيجار</Button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            {type === "company" ? (
              <Input placeholder="كود السيارة" value={code} onChange={(e) => setCode(e.target.value)} />
            ) : (
              <Input placeholder="كود الهاند هيلد إيجار" value={handheldCode} onChange={(e) => setHandheldCode(e.target.value)} dir="ltr" />
            )}
            <Input placeholder="رقم اللوحة" value={plate} onChange={(e) => setPlate(e.target.value)} />
            <Button onClick={add} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
          <Input placeholder="وصف السيارة (اختياري)" value={description} onChange={(e) => setDescription(e.target.value)} />
          {type === "rental" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="كود خط السير" value={routeCode} onChange={(e) => setRouteCode(e.target.value)} dir="ltr" />
              <Input placeholder="وصف خط السير" value={routeDescription} onChange={(e) => setRouteDescription(e.target.value)} />
              <select className="border rounded-md px-2 text-sm bg-background" value={followOfficeId} onChange={(e) => setFollowOfficeId(e.target.value)}>
                <option value="">تابع إلى مكتب...</option>
                {offices.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
        </div>


        <DataToolbar
          search={search}
          onSearch={setSearch}
          onExport={() => exportToXlsx(`cars-${type}.xlsx`, (data ?? []).map((c: any) => ({
            code: c.code, plate: c.plate, type: c.type, description: c.description ?? "",
            handheld_code: c.handheld_code, route_code: c.route_code, route_description: c.route_description,
            office: c.follow_office?.name ?? "",
          })))}
          onImportRows={importCars}
          placeholder="بحث بالكود أو اللوحة أو الخط..."
        />

        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>}
          {filtered.length === 0 && !isLoading && <p className="text-sm text-muted-foreground text-center py-4">لا توجد سيارات</p>}
          {filtered.map((c: any) => (
            <div key={c.id}>
              <div className="flex items-center justify-between bg-muted/50 rounded-md p-2.5 gap-2">
                <div className="text-sm min-w-0">
                  <div className="font-medium">{c.code || "—"} {c.plate && <span className="text-muted-foreground">· لوحة: {c.plate}</span>}</div>
                  {c.description && <div className="text-xs text-muted-foreground mt-0.5">الوصف: {c.description}</div>}
                  {type === "rental" && (
                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      {c.handheld_code && <div>كود الهاند هيلد: <span dir="ltr">{c.handheld_code}</span></div>}
                      {c.route_code && <div>كود الخط: <span dir="ltr">{c.route_code}</span></div>}
                      {c.route_description && <div>وصف الخط: {c.route_description}</div>}
                      {c.follow_office?.name && <div>تابع: {c.follow_office.name}</div>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...c })}>تعديل</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {editing?.id === c.id && (
                <div className="border rounded-md p-3 space-y-2 bg-background mt-1">
                  <div className="font-medium text-sm">
                    تعديل سيارة {editing.type === "rental" ? "إيجار" : "شركة"} — {editing.plate || editing.code}
                  </div>
                  <Label className="text-xs">رقم اللوحة</Label>
                  <Input placeholder="رقم اللوحة" value={editing.plate ?? ""} onChange={(e) => setEditing({ ...editing, plate: e.target.value })} />
                  <Label className="text-xs">وصف السيارة</Label>
                  <Input placeholder="وصف السيارة" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  {editing.type === "company" ? (
                    <>
                      <Label className="text-xs">كود السيارة</Label>
                      <Input placeholder="كود السيارة" value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} dir="ltr" />
                    </>
                  ) : (
                    <>
                      <Label className="text-xs">كود الهاند هيلد إيجار</Label>
                      <Input placeholder="كود الهاند هيلد إيجار" value={editing.handheld_code ?? ""} onChange={(e) => setEditing({ ...editing, handheld_code: e.target.value })} dir="ltr" />
                      <Label className="text-xs">كود خط السير</Label>
                      <Input placeholder="كود خط السير" value={editing.route_code ?? ""} onChange={(e) => setEditing({ ...editing, route_code: e.target.value })} dir="ltr" />
                      <Label className="text-xs">وصف خط السير</Label>
                      <Input placeholder="وصف خط السير" value={editing.route_description ?? ""} onChange={(e) => setEditing({ ...editing, route_description: e.target.value })} />
                      <Label className="text-xs">تابع إلى مكتب</Label>
                      <select className="border rounded-md px-2 py-2 text-sm bg-background w-full" value={editing.follow_office_id ?? ""} onChange={(e) => setEditing({ ...editing, follow_office_id: e.target.value })}>
                        <option value="">تابع إلى مكتب...</option>
                        {offices.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>حفظ</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LookupManager({ table, title, withSap, withCode, withCostCenter }: { table: string; title: string; withSap?: boolean; withCode?: boolean; withCostCenter?: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = usePersistedState(`lookup.${table}.name`, "");
  const [sap, setSap] = usePersistedState(`lookup.${table}.sap`, "");
  const [code, setCode] = usePersistedState(`lookup.${table}.code`, "");
  const [costCenter, setCostCenter] = usePersistedState(`lookup.${table}.cost_center`, "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");


  const { data, isLoading } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  async function add() {
    if (!name.trim()) return;
    if (withSap && !sap.trim()) return toast.error("رقم الساب مطلوب");
    setSaving(true);
    const payload: any = { name: name.trim() };
    if (withSap) payload.sap_number = sap.trim();
    if (withCode) payload.code = code.trim() || null;
    if (withCostCenter) payload.cost_center = costCenter.trim() || null;
    const { error } = await supabase.from(table as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(arabicError(error));
    setName(""); setSap(""); setCode(""); setCostCenter("");
    qc.invalidateQueries({ queryKey: [table] });
    toast.success("تمت الإضافة");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!(editing.name ?? "").trim()) return toast.error("الاسم مطلوب");
    const payload: any = { name: editing.name.trim() };
    if (withSap) payload.sap_number = (editing.sap_number ?? "").trim() || null;
    if (withCode) payload.code = (editing.code ?? "").trim() || null;
    if (withCostCenter) payload.cost_center = (editing.cost_center ?? "").trim() || null;
    const { error } = await supabase.from(table as any).update(payload).eq("id", editing.id);
    if (error) return toast.error(arabicError(error));
    setEditing(null);
    qc.invalidateQueries({ queryKey: [table] });
    toast.success("تم الحفظ");
  }

  async function remove(id: string) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(arabicError(error));
    qc.invalidateQueries({ queryKey: [table] });
    toast.success("تم الحذف");
  }

  async function importRows(rows: any[]) {
    const payload = rows.map((r) => {
      const name = pick(r, "name", "الاسم");
      if (!name) return null;
      const p: any = { name };
      if (withSap) p.sap_number = pick(r, "sap_number", "sap", "رقم الساب", "ساب") || null;
      if (withCode) p.code = pick(r, "code", "الكود", "كود المكتب") || null;
      if (withCostCenter) p.cost_center = pick(r, "cost_center", "مركز التكلفة") || null;
      return p;
    }).filter(Boolean) as any[];
    if (!payload.length) return toast.error("لا توجد صفوف صالحة في الملف");

    // إزالة التكرار داخل الملف بناءً على الاسم (فهو الحقل الفريد في كل الجداول)
    const seen = new Set<string>();
    const deduped: any[] = [];
    let dupInFile = 0;
    for (const p of payload) {
      const key = (p.name ?? "").toString().trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) { dupInFile++; continue; }
      seen.add(key);
      deduped.push(p);
    }

    const chunkSize = 200;
    let ok = 0;
    let firstError: any = null;
    for (let i = 0; i < deduped.length; i += chunkSize) {
      const chunk = deduped.slice(i, i + chunkSize);
      const { error } = await supabase
        .from(table as any)
        .upsert(chunk, { onConflict: "name", ignoreDuplicates: true });
      if (error) { firstError = error; break; }
      ok += chunk.length;
    }
    qc.invalidateQueries({ queryKey: [table] });
    if (firstError) {
      const raw = firstError?.message || firstError?.details || firstError?.hint || JSON.stringify(firstError);
      return toast.error(`فشل الاستيراد بعد ${ok} صف: ${arabicError(firstError, raw || "حدث خطأ غير متوقع")}`);
    }
    const extra = dupInFile ? ` — تم تجاهل ${dupInFile} صف مكرر` : "";
    toast.success(`تم استيراد ${ok} صف${extra}`);
  }


  const filtered = (data ?? []).filter((i: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [i.name, i.sap_number, i.code, i.cost_center].some((v) => (v ?? "").toString().toLowerCase().includes(q));
  });

  const extraCol = withSap || withCode || withCostCenter;
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className={`grid gap-2 ${extraCol ? "grid-cols-1 sm:grid-cols-[1fr_140px_140px_auto]" : "grid-cols-[1fr_auto]"}`}>
            <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
            {withSap && <Input placeholder="رقم الساب" value={sap} onChange={(e) => setSap(e.target.value)} dir="ltr" />}
            {withCostCenter && <Input placeholder="مركز التكلفة" value={costCenter} onChange={(e) => setCostCenter(e.target.value)} dir="ltr" />}
            {withCode && <Input placeholder="كود المكتب" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />}
            <Button onClick={add} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
        </div>

        <DataToolbar
          search={search}
          onSearch={setSearch}
          onExport={() => exportToXlsx(`${table}.xlsx`, (data ?? []).map((i: any) => ({
            name: i.name,
            ...(withSap ? { sap_number: i.sap_number } : {}),
            ...(withCostCenter ? { cost_center: i.cost_center } : {}),
            ...(withCode ? { code: i.code } : {}),
          })))}
          onImportRows={importRows}
          placeholder="بحث..."
        />

        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>}
          {filtered.length === 0 && !isLoading && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>}
          {filtered.map((i: any) => (
            <div key={i.id}>
              <div className="flex items-center justify-between bg-muted/50 rounded-md p-2.5 gap-2">
                <div className="text-sm min-w-0">
                  <div className="font-medium">{i.name}</div>
                  {i.sap_number && <div className="text-xs text-muted-foreground" dir="ltr">SAP: {i.sap_number}</div>}
                  {i.cost_center && <div className="text-xs text-muted-foreground" dir="ltr">مركز التكلفة: {i.cost_center}</div>}
                  {i.code && <div className="text-xs text-muted-foreground" dir="ltr">كود: {i.code}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...i })}>تعديل</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(i.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {editing?.id === i.id && (
                <div className="border rounded-md p-3 space-y-2 bg-background mt-1">
                  <div className="font-medium text-sm">تعديل — {editing.name}</div>
                  <Label className="text-xs">الاسم</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  {withSap && (
                    <>
                      <Label className="text-xs">رقم الساب</Label>
                      <Input value={editing.sap_number ?? ""} onChange={(e) => setEditing({ ...editing, sap_number: e.target.value })} dir="ltr" />
                    </>
                  )}
                  {withCostCenter && (
                    <>
                      <Label className="text-xs">مركز التكلفة</Label>
                      <Input value={editing.cost_center ?? ""} onChange={(e) => setEditing({ ...editing, cost_center: e.target.value })} dir="ltr" />
                    </>
                  )}
                  {withCode && (
                    <>
                      <Label className="text-xs">كود المكتب</Label>
                      <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} dir="ltr" />
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>حفظ</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
