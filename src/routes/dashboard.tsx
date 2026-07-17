import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wrench, LogOut, ClipboardList, Users, Settings } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | Service Tracker Pro" },
      { name: "description", content: "لوحة تحكم الأدمن لإدارة طلبات الخدمة." },
    ],
  }),
  component: Dashboard,
});

type Session = { username: string; role: string };

function Dashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("stp_session");
    if (!raw) {
      navigate({ to: "/" });
      return;
    }
    try {
      setSession(JSON.parse(raw) as Session);
    } catch {
      navigate({ to: "/" });
    }
  }, [navigate]);

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("stp_session");
    }
    navigate({ to: "/" });
  };

  if (!session) return null;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Service Tracker Pro</h1>
              <p className="text-xs text-slate-500">
                مرحباً، <span className="font-medium text-slate-700">{session.username}</span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900">لوحة التحكم</h2>
        <p className="mt-1 text-sm text-slate-500">
          نقطة بداية للنسخة الجديدة — سنضيف الطلبات والبيانات هنا.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: ClipboardList, title: "طلبات الخدمة", value: "0", hint: "لا توجد طلبات بعد" },
            { icon: Users, title: "المستخدمون", value: "1", hint: "أنت فقط حالياً" },
            { icon: Settings, title: "الإعدادات", value: "—", hint: "قريباً" },
          ].map(({ icon: Icon, title, value, hint }) => (
            <div
              key={title}
              className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">{title}</span>
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
              <div className="mt-1 text-xs text-slate-500">{hint}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
