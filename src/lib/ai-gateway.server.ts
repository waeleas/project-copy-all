import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** موفّر Lovable AI Gateway — يُستخدم في كود الخادم فقط */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}
