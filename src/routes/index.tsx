import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | Service Tracker Pro" },
      {
        name: "description",
        content: "سجّل الدخول إلى حسابك في Service Tracker Pro لإدارة طلبات الخدمة.",
      },
      { property: "og:title", content: "تسجيل الدخول | Service Tracker Pro" },
      {
        property: "og:description",
        content: "سجّل الدخول إلى حسابك في Service Tracker Pro لإدارة طلبات الخدمة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

// Demo admin credentials (client-side prototype only)
const ADMIN_USERNAME = "waeleas";
const ADMIN_PASSWORD = "123456";

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "stp_session",
          JSON.stringify({ username, role: "admin" }),
        );
      }
      navigate({ to: "/dashboard" });
      return;
    }

    setError("اسم المستخدم أو كلمة المرور غير صحيحة");
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen w-full bg-gradient-to-b from-sky-100 via-sky-50 to-white flex items-center justify-center px-4 py-12"
    >
      <section className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-100 p-8 sm:p-10">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20">
            <Wrench className="h-7 w-7 text-white" strokeWidth={2.25} />
          </div>
        </div>

        <div className="mt-5 text-center">
          <h1 className="text-xl font-bold text-slate-900">تسجيل الدخول إلى حسابك</h1>
          <p className="mt-1 text-sm text-slate-500">
            أدخل بيانات الاعتماد للوصول إلى لوحة التحكم
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-sm font-medium text-slate-700">
              اسم المستخدم
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="waeleas"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              dir="ltr"
            />
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:bg-blue-800"
          >
            تسجيل الدخول
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center">
          <a href="#" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            نسيت كلمة المرور؟
          </a>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <p className="text-sm text-slate-500">
            ليس لديك حساب؟{" "}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
              إنشاء حساب جديد
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
