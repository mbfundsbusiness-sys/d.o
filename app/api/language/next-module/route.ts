import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import { getActiveLessonGroupId } from '@/lib/language/hierarchy';
import type { ModuleContent, ModuleFocusArea } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const NEXT_MODULE_SYSTEM = `You are a language curriculum designer generating the next module in a personalised curriculum.

Based on:
- The user's assessment (level, goal, style)
- The module they just completed (title, focus area, content)
- Time spent on the module (from activity timer)
- Mistakes or difficulties surfaced in the tutor chat

Generate ONE next module as a JSON object with:
- title: string
- focus_area: one of "vocabulary", "grammar", "listening", "speaking", "reading"
- content: object (same shapes as described in the curriculum generation system)

Adaptive rules:
- If the tutor chat shows the user struggled with grammar, reinforce with a grammar module or a vocabulary module that uses the grammar pattern
- If time spent was very short (<10 min), the module may have been too easy — increase difficulty
- If time spent was very long (>45 min), the module may have been too hard — review and reinforce
- If no tutor chat exists, generate the next logical progression
- Don't repeat the same focus_area more than twice in a row unless the user's style demands it
- Keep progressing the curriculum forward while reinforcing weak areas

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
    const { moduleId, language } = body as { moduleId: string; language: string };

    if (!moduleId || !language) {
      return NextResponse.json({ error: 'moduleId and language required' }, { status: 400 });
    }

    // Get the completed module
    const { data: completedModule } = await supabaseServer
      .from('language_modules')
      .select('*')
      .eq('id', moduleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!completedModule) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Get assessment
    const { data: assessment } = await supabaseServer
      .from('language_assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .maybeSingle();

    // Get tutor chat for this module (to surface mistakes)
    const { data: tutorMessages } = await supabaseServer
      .from('language_tutor_messages')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true });

    // Get language sessions for this module's time (last session for this language)
    const { data: sessions } = await supabaseServer
      .from('language_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .not('duration_min', 'is', null)
      .order('started_at', { ascending: false })
      .limit(5);

    // Get all modules to know what's been covered
    const { data: allModules } = await supabaseServer
      .from('language_modules')
      .select('module_number, title, focus_area, completed')
      .eq('user_id', userId)
      .eq('language', language)
      .order('module_number', { ascending: true });

    const nextModuleNumber = (allModules?.[allModules.length - 1]?.module_number ?? 0) + 1;

    // Build context for AI
    const tutorChatStr = tutorMessages && tutorMessages.length > 0
      ? tutorMessages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')
      : 'No tutor chat for this module.';

    const sessionsStr = sessions && sessions.length > 0
      ? sessions.map((s: { started_at: string; duration_min: number | null }) =>
          `${new Date(s.started_at).toLocaleDateString('en-GB')}: ${s.duration_min}min`
        ).join('\n')
      : 'No session data.';

    const modulesStr = allModules && allModules.length > 0
      ? allModules.map((m: { module_number: number; title: string; focus_area: string; completed: boolean }) =>
          `Module ${m.module_number}: ${m.title} (${m.focus_area}) ${m.completed ? '✓' : '○'}`
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
            content: `Generate the next module for ${language}.

Assessment:
- Level: ${assessment?.level ?? 'beginner'}
- Goal: ${assessment?.goal ?? 'general fluency'}
- Style: ${assessment?.style ?? 'vocabulary_heavy'}

Completed module:
- Title: ${completedModule.title}
- Focus area: ${completedModule.focus_area}
- Content: ${JSON.stringify(completedModule.content_json)}

Tutor chat (for mistakes/difficulties):
${tutorChatStr}

Recent session durations:
${sessionsStr}

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

    let moduleData: { title: string; focus_area: ModuleFocusArea; content: ModuleContent };
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      moduleData = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse module data' }, { status: 502 });
    }

    const lessonGroupId = await getActiveLessonGroupId(supabaseServer, userId, language);

    const { data: inserted, error: insertError } = await supabaseServer
      .from('language_modules')
      .insert({
        user_id: userId,
        language,
        module_number: nextModuleNumber,
        title: moduleData.title,
        focus_area: moduleData.focus_area,
        content_json: moduleData.content,
        completed: false,
        lesson_group_id: lessonGroupId,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ module: inserted });
  } catch (err) {
    console.error('Next module error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
