import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { CourseModuleContent } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const NEXT_MODULE_SYSTEM = `You are a study-companion AI generating the next module in a course study
sequence. Based on:
- The course's syllabus/notes (if provided)
- The module the student just completed (title, content)
- Questions or difficulties surfaced in the tutor chat for that module
- All modules covered so far

Generate ONE next module as a JSON object with:
- title: string (a specific, real topic from the course, not yet covered)
- content: { "intro", "key_points", "terms", "practice_questions", "lab_or_exercise", "resources" }
  (same shapes as the curriculum generation system)

Adaptive rules:
- If the tutor chat shows the student struggled with a concept, reinforce it
  before moving on, or fold a review point into the next module's key_points.
- Follow the syllabus order when one is provided; otherwise progress logically.
- Don't repeat a topic already covered unless reinforcing a weak area.
- Keep technical/security content strictly educational and defensive.

Return ONLY a JSON object, no other text.`;

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
    const { moduleId, courseName } = body as { moduleId: string; courseName: string };

    if (!moduleId || !courseName) {
      return NextResponse.json({ error: 'moduleId and courseName required' }, { status: 400 });
    }

    const { data: completedModule } = await supabaseServer
      .from('course_modules')
      .select('*')
      .eq('id', moduleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!completedModule) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const { data: profile } = await supabaseServer
      .from('course_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('course_name', courseName)
      .maybeSingle();

    const { data: tutorMessages } = await supabaseServer
      .from('course_tutor_messages')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true });

    const { data: allModules } = await supabaseServer
      .from('course_modules')
      .select('module_number, title, completed')
      .eq('user_id', userId)
      .eq('course_name', courseName)
      .order('module_number', { ascending: true });

    const nextModuleNumber = (allModules?.[allModules.length - 1]?.module_number ?? 0) + 1;

    const tutorChatStr = tutorMessages && tutorMessages.length > 0
      ? tutorMessages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')
      : 'No tutor chat for this module.';

    const modulesStr = allModules && allModules.length > 0
      ? allModules.map((m: { module_number: number; title: string; completed: boolean }) =>
          `Module ${m.module_number}: ${m.title} ${m.completed ? '✓' : '○'}`
        ).join('\n')
      : 'No prior modules.';

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let rawText: string;
    try {
      rawText = await callGemini({
        apiKey,
        system: NEXT_MODULE_SYSTEM,
        maxOutputTokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Course: ${courseName}
${profile?.syllabus ? `Syllabus / notes:\n${profile.syllabus}` : 'No syllabus provided.'}

Completed module:
- Title: ${completedModule.title}
- Content: ${JSON.stringify(completedModule.content_json)}

Tutor chat (for difficulties):
${tutorChatStr}

All modules so far:
${modulesStr}

Next module number: ${nextModuleNumber}

Return ONLY a JSON object for the next module.`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    let moduleData: { title: string; content: CourseModuleContent };
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      moduleData = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse module data' }, { status: 502 });
    }

    const { data: inserted, error: insertError } = await supabaseServer
      .from('course_modules')
      .insert({
        user_id: userId,
        course_name: courseName,
        module_number: nextModuleNumber,
        title: moduleData.title,
        content_json: moduleData.content,
        completed: false,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ module: inserted });
  } catch (err) {
    console.error('Next course module error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
