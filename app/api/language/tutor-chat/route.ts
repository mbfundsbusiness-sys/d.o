import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseServer = getSupabaseServer();
    const { data: userData, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { message, moduleId, language } = body as {
      message: string;
      moduleId: string;
      language: string;
    };

    if (!message || !moduleId || !language) {
      return NextResponse.json({ error: 'message, moduleId, and language required' }, { status: 400 });
    }

    // Get module
    const { data: module } = await supabaseServer
      .from('language_modules')
      .select('*')
      .eq('id', moduleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Get assessment
    const { data: assessment } = await supabaseServer
      .from('language_assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .maybeSingle();

    // Get tutor chat history
    const { data: history } = await supabaseServer
      .from('language_tutor_messages')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true })
      .limit(20);

    const systemPrompt = `You are a language tutor helping the user learn ${language}.

Module context:
- Module: ${module.title} (Module ${module.module_number})
- Focus area: ${module.focus_area}
- Module content: ${JSON.stringify(module.content_json)}

${assessment ? `Student context:
- Level: ${assessment.level}
- Goal: ${assessment.goal}
- Learning style: ${assessment.style}` : ''}

Your role:
- Answer questions about the module content
- Provide more examples when asked
- Check things the user writes in ${language} and give corrections with explanations
- Be encouraging and patient
- Keep explanations concise
- When correcting, show what was wrong, why, and the correct version
- Use English for explanations unless the user asks for immersion`;

    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    if (history) {
      for (const msg of history) {
        historyMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...historyMessages,
          { role: 'user' as const, content: message },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const assistantContent = data.content?.[0]?.text ?? 'Sorry, I could not generate a response.';

    // Persist both messages
    await supabaseServer.from('language_tutor_messages').insert([
      { user_id: userId, module_id: moduleId, role: 'user', content: message },
      { user_id: userId, module_id: moduleId, role: 'assistant', content: assistantContent },
    ]);

    return NextResponse.json({ response: assistantContent });
  } catch (err) {
    console.error('Tutor chat error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
