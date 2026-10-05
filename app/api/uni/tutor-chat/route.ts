import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import { uniModuleByKey } from '@/lib/uni/modules';

export const runtime = 'nodejs';

const BASE_PROMPT = `You are an AI tutor for a student on a BEng Electrical and Electronic Engineering programme. You tutor exactly one module (below) and stay in that subject; if asked about another module, say that module has its own tutor and give a brief pointer only.

How to tutor:
- Be concise, precise and encouraging; define jargon the first time it appears
- Teach, don't just answer: explain the idea, work one example, then check understanding
- For coursework or assessed work, give hints and method before full solutions, and never fabricate results, references or data
- Show equations step by step with units, and sanity-check answers
- If you are unsure of something or the question is ambiguous, say so or ask, rather than guessing
- You can help with the student's study tasks (revision plans, practice questions, explaining lecture notes they paste in)
- Plain text and simple formatting only`;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabaseServer = getSupabaseServer();
    const { data: userData, error: authError } = await supabaseServer.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = userData.user.id;

    const { message, moduleKey } = (await req.json()) as { message?: string; moduleKey?: string };
    const mod = moduleKey ? uniModuleByKey(moduleKey) : undefined;
    if (!message || typeof message !== 'string' || !mod) {
      return NextResponse.json({ error: 'message and a valid moduleKey required' }, { status: 400 });
    }

    const [historyRes, todosRes] = await Promise.all([
      supabaseServer
        .from('uni_tutor_messages')
        .select('role, content')
        .eq('user_id', userId)
        .eq('module_key', mod.key)
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseServer
        .from('todo_items')
        .select('title, notes, due_at')
        .eq('user_id', userId)
        .eq('completed', false)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(15),
    ]);

    const history = ((historyRes.data ?? []) as { role: 'user' | 'assistant'; content: string }[]).reverse();
    const todos = (todosRes.data ?? []) as { title: string; notes: string | null; due_at: string | null }[];
    const todoText = todos.length
      ? `\n\nStudent's open to-do items (may include coursework relevant to this module):\n${todos
          .map((t) => `- ${t.title}${t.due_at ? ` (due ${new Date(t.due_at).toLocaleDateString('en-GB')})` : ''}${t.notes ? ` — ${t.notes}` : ''}`)
          .join('\n')}`
      : '';

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured. Add GEMINI_API_KEY in the secrets panel.' }, { status: 503 });
    }

    let reply: string;
    try {
      reply = await callGemini({
        apiKey,
        system: `${BASE_PROMPT}\n\n${mod.brief}${todoText}`,
        maxOutputTokens: 1536,
        messages: [...history, { role: 'user' as const, content: message }],
      });
    } catch (err) {
      console.error('Uni tutor Gemini error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    await supabaseServer.from('uni_tutor_messages').insert([
      { user_id: userId, module_key: mod.key, role: 'user', content: message },
      { user_id: userId, module_key: mod.key, role: 'assistant', content: reply },
    ]);

    return NextResponse.json({ response: reply });
  } catch (err) {
    console.error('Uni tutor chat error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
