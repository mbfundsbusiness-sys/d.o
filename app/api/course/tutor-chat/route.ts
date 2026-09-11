import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';

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
    const { message, moduleId, courseName } = body as {
      message: string;
      moduleId: string;
      courseName: string;
    };

    if (!message || !moduleId || !courseName) {
      return NextResponse.json({ error: 'message, moduleId, and courseName required' }, { status: 400 });
    }

    const { data: module } = await supabaseServer
      .from('course_modules')
      .select('*')
      .eq('id', moduleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const { data: profile } = await supabaseServer
      .from('course_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('course_name', courseName)
      .maybeSingle();

    const { data: history } = await supabaseServer
      .from('course_tutor_messages')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true })
      .limit(20);

    const systemPrompt = `You are a study tutor helping the student complete their course: ${courseName}.

Module context:
- Module ${module.module_number}: ${module.title}
- Module content: ${JSON.stringify(module.content_json)}

${profile?.syllabus ? `Course syllabus / notes:\n${profile.syllabus}\n` : ''}

Your role:
- Answer questions about this module's content, clearly and precisely
- Quiz the student or explain a concept a different way if they're stuck
- Where the subject is security-related, keep everything strictly educational
  and defensive — explain how mechanisms/attacks work conceptually and how to
  defend against them, never provide operational instructions for attacking a
  real system without authorization
- Be concise and encouraging
- Use plain English; define jargon the first time it's used`;

    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    if (history) {
      for (const msg of history) {
        historyMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let assistantContent: string;
    try {
      assistantContent = await callGemini({
        apiKey,
        system: systemPrompt,
        maxOutputTokens: 1024,
        messages: [
          ...historyMessages,
          { role: 'user' as const, content: message },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    await supabaseServer.from('course_tutor_messages').insert([
      { user_id: userId, module_id: moduleId, role: 'user', content: message },
      { user_id: userId, module_id: moduleId, role: 'assistant', content: assistantContent },
    ]);

    return NextResponse.json({ response: assistantContent });
  } catch (err) {
    console.error('Course tutor chat error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
