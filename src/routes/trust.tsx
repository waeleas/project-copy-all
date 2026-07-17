import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "الأمان والخصوصية" },
      {
        name: "description",
        content:
          "صفحة الأمان والخصوصية الخاصة بالتطبيق: عناصر التحكم في الوصول، حماية البيانات، وقنوات التواصل.",
      },
    ],
  }),
  component: TrustPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TrustPage() {
  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">الأمان والخصوصية</h1>
        <p className="text-sm text-muted-foreground">
          تتم صيانة هذه الصفحة من قِبل مالك التطبيق للإجابة عن الأسئلة الشائعة حول الأمان
          والخصوصية. هذه الصفحة محتوى قابل للتحرير من قِبل المالك وليست شهادة مستقلة.
        </p>
      </header>

      <Section title="الوصول والمصادقة">
        تسجيل الدخول يتم باسم المستخدم وكلمة المرور. عند إنشاء حساب جديد تُمنح كلمة مرور
        افتراضية ويُطلب من المستخدم تغييرها عند أول دخول. الصلاحيات الإدارية تُمنح فقط
        لحسابات محددة من قِبل مسؤول التطبيق.
      </Section>

      <Section title="حماية البيانات">
        البيانات مخزّنة في قاعدة بيانات مُدارة مع تفعيل سياسات الوصول على مستوى الصفوف
        (RLS) لقصر الاطلاع والتعديل على المستخدم المالك للسجل أو على المسؤولين فقط بحسب
        نوع البيانات.
      </Section>

      <Section title="الاستضافة والمنصة">
        التطبيق مبنيّ ومستضاف على منصة Lovable Cloud. هذه إفادة وقائعية عن قدرات المنصة
        المُفعَّلة، وليست شهادة اعتماد.
      </Section>

      <Section title="جمع البيانات واستخدامها">
        يجمع التطبيق فقط البيانات اللازمة لتشغيل الخدمة (بيانات الحساب، الرحلات،
        المرفقات). لا تُستخدم البيانات لأغراض تسويقية ولا تُشارك مع أطراف ثالثة لأغراض
        إعلانية.
      </Section>

      <Section title="الاحتفاظ والحذف">
        يُحتفظ بسجلات الرحلات لأغراض التشغيل والمراجعة. عند حذف مستخدم تبقى الرحلات
        المسجَّلة باسمه دون ربطها بهويته. للاستفسار عن حذف بيانات إضافية يرجى التواصل
        مع مسؤول التطبيق.
      </Section>

      <Section title="التواصل بخصوص الأمان">
        للإبلاغ عن مشكلة أمنية أو طلب يخص الخصوصية، يرجى التواصل مع مسؤول التطبيق داخل
        المؤسسة.
      </Section>

      <div className="pt-4">
        <Link to="/" className="text-sm text-primary underline">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
