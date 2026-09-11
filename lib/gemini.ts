import { GoogleGenerativeAI } from '@google/generative-ai';

// Lite tier carries a much higher free-tier daily quota than gemini-3.6-flash
// (which caps at 20 requests/day on the free plan) — this app makes 8+
// distinct AI calls across features, so the lite model avoids exhausting
// the quota during normal use.
const GEMINI_MODEL = 'gemini-flash-lite-latest';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

/**
 * Sends a system prompt + message history to Gemini, mirroring the
 * system/messages shape the app's Anthropic calls used.
 * Returns the model's text response, or null if no API key is configured.
 */
export async function callGemini({
  apiKey,
  system,
  messages,
  maxOutputTokens = 2048,
}: {
  apiKey: string;
  system: string;
  messages: ChatMessage[];
  maxOutputTokens?: number;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    { model: GEMINI_MODEL, systemInstruction: system },
    { timeout: 30_000 }
  );

  // model.startChat().sendMessage() hangs indefinitely with this SDK version
  // against gemini-3.6-flash (never resolves or rejects) — generateContent()
  // with the full contents array is the reliable equivalent.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // gemini-3.6-flash occasionally returns a transient 503 (high demand) —
  // one retry after a short delay clears most of these.
  try {
    const result = await model.generateContent({ contents, generationConfig: { maxOutputTokens } });
    return result.response.text();
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await model.generateContent({ contents, generationConfig: { maxOutputTokens } });
    return result.response.text();
  }
}
