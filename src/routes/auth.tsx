import { arabicError } from "@/lib/errors";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { resolveUsernameToEmail, firstTimeSetPassword } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Car, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "تسجيل الدخول | Service Tracker Pro" },
    { name: "description", content: "تسجيل الدخول إلى نظام متابعة رحلات السيارات." },
    { property: "og:title", content: "تسجيل الدخول | Service Tracker Pro" },
    { property: "og:description", content: "تسجيل الدخول إلى نظام متابعة رحلات السيارات." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const resolve = useServerFn(resolveUsernameToEmail);
  const firstTime = useServerFn(firstTimeSetPassword);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // First-time setup mode
  const [setupMode, setSetupMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("auth.rememberMe");
      if (saved !== null) setRememberMe(saved === "true");
    } catch {}
  }, []);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return toast.error("اسم المستخدم وكلمة المرور مطلوبان");
    setLoading(true);
    try {
      const { email, must_change_password, reason } = await resolve({ data: { username: username.trim() } });
      if (!email) {
        toast.error(reason === "account_missing"
          ? "اسم المستخدم مسجّل لكن حساب الدخول المرتبط به غير موجود؛ تواصل مع مسؤول البرنامج"
          : `اسم المستخدم «${username.trim()}» غير مسجّل؛ تأكد من كتابته أو من رقم الساب`);
        return;
      }
      if (must_change_password) {
        toast.info("هذا أول دخول لك، يرجى تعيين كلمة مرور جديدة");
        setSetupMode(true);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(arabicError(error));
        return;
      }
      try {
        localStorage.setItem("auth.rememberMe", String(rememberMe));
      } catch {}
      toast.success("تم تسجيل الدخول");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(arabicError(err, "تعذر تسجيل الدخول؛ لم تحدد الخدمة سببًا واضحًا"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("كلمة المرور يجب أن لا تقل عن 8 أحرف");
    if (newPassword !== confirmPassword) return toast.error("كلمتا المرور غير متطابقتين");
    setLoading(true);
    try {
      const result = await firstTime({
        data: { username: username.trim(), new_password: newPassword },
      });
      if (result.error === "weak_password") {
        toast.error(arabicError(result.message, "كلمة المرور ضعيفة، اختر كلمة أقوى"));
        return;
      }
      const { email } = result;
      if (!email) {
        toast.error("تعذر تعيين كلمة المرور");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: newPassword });
      if (error) {
        toast.error("تم تعيين كلمة المرور لكن تعذر تسجيل الدخول: " + arabicError(error));
        return;
      }
      try {
        localStorage.setItem("auth.rememberMe", String(rememberMe));
      } catch {}
      toast.success("تم تعيين كلمة المرور وتسجيل الدخول");
      navigate({ to: "/" });
    } catch (err: any) {
      const msg = String(err?.message ?? err ?? "");
      if (/weak|pwned|known to be|easy to guess/i.test(msg)) {
        toast.error("كلمة المرور ضعيفة أو مسربة، اختر كلمة أقوى (مزيج من أحرف كبيرة وصغيرة وأرقام ورموز)");
      } else {
        toast.error(arabicError(err, "حدث خطأ"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Car className="size-7" />
          </div>
          <CardTitle className="text-2xl">
            {setupMode ? "تعيين كلمة مرور جديدة" : "خطوط سير السيارات"}
          </CardTitle>
          <CardDescription>
            {setupMode
              ? `أول دخول للمستخدم: ${username} — قم بتعيين كلمة مرور`
              : "سجل دخولك لإدارة الحركة رحلات خدمة ما بعد البيع ونقل عاملين"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!setupMode ? (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label>اسم المستخدم أو رقم الساب</Label>
                <Input required value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" autoComplete="username" placeholder="اسم المستخدم أو رقم الساب" />
              </div>
              <div className="space-y-1.5">
                <Label>كلمة المرور</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="current-password" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(Boolean(v))}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  تذكرني (ابقَ متصلاً حتى الخروج)
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="ml-2 size-4 animate-spin" />} تسجيل الدخول
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label>كلمة المرور الجديدة</Label>
                <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="ltr" autoComplete="new-password" minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label>تأكيد كلمة المرور</Label>
                <Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} dir="ltr" autoComplete="new-password" minLength={8} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="ml-2 size-4 animate-spin" />} حفظ وتسجيل الدخول
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setSetupMode(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                رجوع
              </Button>
            </form>
          )}
          <p className="text-xs text-muted-foreground text-center mt-4">
            <Link to="/" className="hover:underline">العودة للرئيسية</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
