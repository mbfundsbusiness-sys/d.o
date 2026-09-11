import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { LanguageAssessment, LanguageModule, ModuleContent, ModuleFocusArea } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const MODULE_GEN_SYSTEM = `You are a language curriculum designer. Based on the user's assessment, generate language learning modules as structured JSON.

Each module must be a JSON object with these fields:
- title: string (short, descriptive)
- focus_area: one of "vocabulary", "grammar", "listening", "speaking", "reading"
- content: an object whose shape depends on focus_area:

For "vocabulary":
{ "intro": string, "words": [{ "word": string, "translation": string, "example": string, "example_translation": string }] }
Include 8-10 words appropriate for the level.

For "grammar":
{ "intro": string, "rule": string (clear explanation of the rule), "practice_sentences": { "prompt": string, "answer": string } }
Include 3-4 practice sentences. The prompt should be an English sentence to translate, the answer the target language translation.

For "listening":
{ "intro": string, "listening_prompt": string (a short passage or dialogue in the target language, ~100 words), "tips": string[] }
Include 2-3 tips on what to listen for.

For "speaking":
{ "intro": string, "speaking_prompts": string[] (4-5 prompts to respond to in the target language) }

For "reading":
{ "intro": string, "reading_text": string (a short passage in the target language, ~100-150 words), "reading_questions": [{ "question": string, "answer": string }] }
Include 3-4 comprehension questions.

Rules:
- Generate 3-5 modules as a starting curriculum
- Order modules logically for a beginner-friendly progression
- All content in the target language should be appropriate for the user's level
- For beginners, keep it simple; for conversational level, use more complex content
- Tailor the focus mix to the user's preferred style (vocabulary_heavy → more vocab modules, grammar_first → start with grammar, conversation_first → lean toward speaking/listening)
- Return ONLY a JSON array of module objects, no other text`;

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
    const { language, count } = body as { language: string; count?: number };
    if (!language) {
      return NextResponse.json({ error: 'Language required' }, { status: 400 });
    }

    // Get assessment
    const { data: assessment } = await supabaseServer
      .from('language_assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .maybeSingle();

    if (!assessment) {
      return NextResponse.json({ error: 'No assessment found for this language. Complete the assessment first.' }, { status: 400 });
    }

    // Check existing modules
    const { data: existingModules } = await supabaseServer
      .from('language_modules')
      .select('module_number')
      .eq('user_id', userId)
      .eq('language', language)
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
Language: ${language}
Level: ${assessment.level}
Goal: ${assessment.goal}
Style: ${assessment.style}

Return ONLY a JSON array of ${moduleCount} module objects.`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    // Parse the JSON array from the response
    let modules: { title: string; focus_area: ModuleFocusArea; content: ModuleContent }[];
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      modules = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse module data' }, { status: 502 });
    }

    // Insert modules
    const inserts = modules.map((m, i) => ({
      user_id: userId,
      language,
      module_number: nextModuleNumber + i,
      title: m.title,
      focus_area: m.focus_area,
      content_json: m.content,
      completed: false,
    }));

    const { data: inserted, error: insertError } = await supabaseServer
      .from('language_modules')
      .insert(inserts)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ modules: inserted });
  } catch (err) {
    console.error('Module generation error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
