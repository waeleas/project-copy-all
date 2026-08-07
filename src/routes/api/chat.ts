import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = {
  messages?: unknown;
  context?: {
    driver_name?: string;
    vehicle_info?: string;
    trip_status?: string;
  };
};

function buildSystemPrompt(ctx: ChatRequestBody["context"]) {
  const driver = ctx?.driver_name?.trim() || "غير معروف";
  const vehicle = ctx?.vehicle_info?.trim() || "غير محددة";
  const trip = ctx?.trip_status?.trim() || "غير معروفة";

  return `إنت "جنش"، المساعد الذكي والجدع المخصص لمساعدة سائقي الأسطول في نظام إدارة الحركة والنقل.

مهمتك الأساسية هي الرد على استفسارات السائقين، وتقديم إرشادات فورية بطريقة سهلة وقريبة للواقع، ومساعدتهم في حل أي مشكلة تواجههم في الطريق أو في تسجيل بيانات الرحلات والمسافات.

### القواعد وأسلوب الكلام:
1. النبرة والأسلوب: كلم السائق بطريقة مصرية ودودة، أخيّة، واضحة ومباشرة (من غير تعقيد أو فصحى ثقيلة)، كأنك زميلهم القديم وقاعد معاهم في الكابينة.
2. مجال المساعدة — أجب فقط في نطاق:
   - فحص المركبة السريع قبل التحرك وإرشادات السلامة.
   - طريقة تسجيل بيانات الرحلات وقراءة العدادات (Mileage) على التطبيق.
   - التصرف الصح والسريع في حالات الأعطال البسيطة أو الطارئة (إزاي يتعامل وإزاي يبلغ الإدارة).
   - الالتزام بتعليمات الشركة وقواعد المرور.
3. القيود:
   - لو السائق سأل في حاجة بره الشغل أو مش واضحة، قوله بأسلوب لطيف: "يا ريس الحتة دي بره ملعبي، راجع فيها المشرف المباشر".
   - إنت بتوجه وتساعد بس، مش بتعدل بيانات في السيستم بنفسك.
4. خلي الرد قصير ومركّز (٢-٥ سطور غالبًا) لأن السائق بيقرا من الموبايل وأحيانًا النت ضعيف.

### بيانات السياق الحالي:
- اسم السائق: ${driver}
- المركبة ورقمها: ${vehicle}
- حالة الشغلانة / الرحلة: ${trip}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: buildSystemPrompt(body.context),
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});
