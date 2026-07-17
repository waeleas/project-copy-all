import { arabicError } from "@/lib/errors";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Lock } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "الملف الشخصي — تتبع الرحلات" }] }),
  component: () => <AppShell><ProfilePage /></AppShell>,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      return toast.error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
    }

    if (newPassword !== confirmPassword) {
      return toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقين");
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) return toast.error(arabicError(error));

    toast.success("تم تغيير كلمة المرور بنجاح");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="size-4 ml-1" /> رجوع
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Lock className="size-7" />
          </div>
          <CardTitle className="text-xl">تغيير كلمة المرور</CardTitle>
          <CardDescription>يمكنك هنا تغيير الرقم السري الخاص بك</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input value={user?.email ?? ""} disabled dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>كلمة المرور الجديدة</Label>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                placeholder="6 أحرف على الأقل"
              />
            </div>
            <div className="space-y-1.5">
              <Label>تأكيد كلمة المرور الجديدة</Label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                dir="ltr"
                placeholder="••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="ml-2 size-4 animate-spin" />}
              تحديث كلمة المرور
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

