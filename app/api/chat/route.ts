import { convertToModelMessages, generateId, stepCountIs, streamText, type UIMessage } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAssistant, isAssistantKey } from '@/lib/assistants';
import { gatewayFallback, model } from '@/lib/ai/models';
import { requireUser, unauthorized } from '@/lib/server/auth';
import type { AssistantKey } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** How much of the thread the model sees each turn. */
const CONTEXT_MESSAGES = 30;

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  const assistant = new URL(req.url).searchParams.get('assistant');
  if (!isAssistantKey(assistant)) return Response.json({ error: 'unknown assistant' }, { status: 400 });
  const { data, error } = await auth.db
    .from('chat_messages')
    .select('id, role, parts, created_at')
    .eq('user_id', auth.userId)
    .eq('assistant', assistant)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const messages = (data ?? []).reverse().map(({ id, role, parts }) => ({ id, role, parts })) as UIMessage[];
  return Response.json({ messages });
}

async function save(db: SupabaseClient, userId: string, assistant: AssistantKey, messages: UIMessage[]) {
  const base = Date.now() - messages.length;
  // ignoreDuplicates keeps the original timestamps of messages saved on earlier turns.
  await db.from('chat_messages').upsert(
    messages.map((m, i) => ({
      id: m.id,
      user_id: userId,
      assistant,
      role: m.role,
      parts: m.parts,
      created_at: new Date(base + i).toISOString(),
    })),
    { onConflict: 'id', ignoreDuplicates: true }
  );
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  const { messages, assistant } = (await req.json()) as { messages?: UIMessage[]; assistant?: string };
  if (!isAssistantKey(assistant) || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'assistant and messages required' }, { status: 400 });
  }

  const { system, tools } = await buildAssistant(assistant, auth.db, auth.userId);
  const recent = messages.slice(-CONTEXT_MESSAGES);

  const result = streamText({
    model: model('fast'),
    providerOptions: gatewayFallback('fast'),
    system,
    messages: convertToModelMessages(recent),
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: generateId,
    onFinish: async ({ messages: all }) => {
      // Only the newest user message and the reply are new; older ones were saved already.
      await save(auth.db, auth.userId, assistant, all.slice(-2));
    },
    onError: (e) => {
      console.error('chat error', e);
      return 'The assistant hit an error. Try again in a moment.';
    },
  });
}
