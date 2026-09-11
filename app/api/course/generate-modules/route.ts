import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { CourseModuleContent } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const MODULE_GEN_SYSTEM = `You are a study-companion AI helping someone complete a course they are already
enrolled in elsewhere (e.g. a cybersecurity certification course). You are NOT
inventing an unrelated curriculum — you are breaking the course they describe
into a sequence of digestible study modules that track their actual syllabus.

Each module must be a JSON object with these fields:
- title: string (short, specific — a real topic from the course)
- content: {
    "intro": string (2-3 sentences framing why this topic matters),
    "key_points": string[] (5-8 concise bullet points covering the core ideas),
    "terms": [{ "term": string, "definition": string }] (4-6 key terms/definitions),
    "practice_questions": [{ "question": string, "answer": string }] (3-4 questions
       that test understanding, with model answers),
    "lab_or_exercise": string (one hands-on exercise or scenario to apply the
       material — for cybersecurity this might be a mini CTF-style exercise,
       a config to review, or a scenario to reason through defensively),
    "resources": string[] (2-3 suggested things to look up or practice, described
       generically, not fabricated URLs)
  }

Rules:
- If the user provides a syllabus/notes, follow its topic order and terminology
  closely — don't invent topics that contradict it.
- If no syllabus is given, use standard, well-established coverage for the
  named course/subject.
- Generate 3-5 modules as a starting sequence, ordered logically.
- Keep security/technical content strictly educational and defensive in framing
  (how things work and how to defend against them), never how to attack real
  systems without authorization.
- Return ONLY a JSON array of module objects, no other text.`;

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
    const { courseName, count } = body as { courseName: string; count?: number };
    if (!courseName) {
      return NextResponse.json({ error: 'courseName required' }, { status: 400 });
    }

    const { data: profile } = await supabaseServer
      .from('course_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('course_name', courseName)
      .maybeSingle();

    const { data: existingModules } = await supabaseServer
      .from('course_modules')
      .select('module_number')
      .eq('user_id', userId)
      .eq('course_name', courseName)
      .order('module_number', { ascending: false })
      .limit(1);

    const nextModuleNumber = (existingModules?.[0]?.module_number ?? 0) + 1;
    const moduleCount = count ?? 4;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let rawText: string;
    try {
      rawText = await callGemini({
        apiKey,
        system: MODULE_GEN_SYSTEM,
        maxOutputTokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Generate ${moduleCount} modules for:
Course: ${courseName}
Goal: ${profile?.goal || 'complete the course and retain the material'}
${profile?.syllabus ? `Syllabus / notes provided by the student:\n${profile.syllabus}` : 'No syllabus provided — use standard coverage for this subject.'}

Return ONLY a JSON array of ${moduleCount} module objects.`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    let modules: { title: string; content: CourseModuleContent }[];
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      modules = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse module data' }, { status: 502 });
    }

    const inserts = modules.map((m, i) => ({
      user_id: userId,
      course_name: courseName,
      module_number: nextModuleNumber + i,
      title: m.title,
      content_json: m.content,
      completed: false,
    }));

    const { data: inserted, error: insertError } = await supabaseServer
      .from('course_modules')
      .insert(inserts)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ modules: inserted });
  } catch (err) {
    console.error('Course module generation error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
