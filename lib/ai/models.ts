import { gateway, generateText, type ModelMessage } from 'ai';

// All AI goes through Vercel AI Gateway (AI_GATEWAY_API_KEY locally; OIDC on Vercel).
// Two tiers, both swappable by env var without a code change:
//   fast – routine chat and tool actions (cheap)
//   plan – day planning, morning brief and evening review
export const MODEL_IDS = {
  fast: process.env.AI_MODEL_FAST || 'deepseek/deepseek-v4.1-flash',
  plan: process.env.AI_MODEL_PLAN || 'openai/gpt-6.1-terra',
} as const;

export type ModelTier = keyof typeof MODEL_IDS;

export function model(tier: ModelTier) {
  return gateway(MODEL_IDS[tier]);
}

/** If the chosen model is unavailable, the gateway retries on the other tier's model. */
export function gatewayFallback(tier: ModelTier) {
  const other = tier === 'fast' ? MODEL_IDS.plan : MODEL_IDS.fast;
  return { gateway: { models: [other] } };
}

/** One-shot text call for the simple tutors and generators. */
export async function callModel({
  system,
  messages,
  maxOutputTokens = 2048,
  tier = 'fast',
}: {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxOutputTokens?: number;
  tier?: ModelTier;
}): Promise<string> {
  const { text } = await generateText({
    model: model(tier),
    system,
    messages: messages as ModelMessage[],
    maxOutputTokens,
    providerOptions: gatewayFallback(tier),
  });
  return text;
}
