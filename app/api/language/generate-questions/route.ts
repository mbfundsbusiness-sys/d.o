import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { LangQuestionType, PlayableQuestion } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const QUESTION_COUNT = 8;

const QUESTION_GEN_SYSTEM = `You are a language-lesson question generator. Given one lesson's teaching
content (vocabulary, a grammar rule, a reading/listening passage, etc.) and
the learner's level, generate a sequence of practice questions strictly
about THIS lesson's material — do not introduce vocabulary or grammar that
isn't in the provided content.

Each question is a JSON object:
{
  "question_type": "multiple_choice" | "translation" | "fill_blank",
  "prompt": string,
  "options": string[] | null,   // exactly 4 options, ONLY for multiple_choice, else null
  "correct_answer": string,
  "acceptable_answers": string[], // other exact strings that should also count as correct, [] if none
  "explanation": string,   // one or two sentences, shown when the learner gets it wrong
  "hint": string,          // a small clue, not the answer
  "difficulty": number     // 1-5
}

Rules:
- Generate exactly ${QUESTION_COUNT} questions.
- Order them from easiest to hardest (difficulty roughly 1 -> 5 across the set).
- Mix question types — do not use the same type more than 3 times in a row.
- For "multiple_choice": options must include the correct_answer plus 3
  plausible but wrong choices in the SAME language as the correct_answer.
- For "translation": prompt is an English sentence/phrase, correct_answer is
  the target-language translation.
- For "fill_blank": prompt contains a blank written as "___", correct_answer
  is only the missing word/phrase (not the full sentence).
- Every correct_answer must be unambiguous and directly supported by the
  lesson content provided.
- Return ONLY a JSON array of ${QUESTION_COUNT} question objects, no other text.`;

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
    const { moduleId, force } = body as { moduleId: string; force?: boolean };
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId required' }, { status: 400 });
    }

    const { data: lesson } = await supabaseServer
      .from('language_modules')
      .select('*')
      .eq('id', moduleId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Reuse existing questions unless the caller explicitly asks to regenerate
    // (e.g. "practice again" after failing) — keeps the same set stable across
    // a page refresh mid-lesson.
    if (!force) {
      const { data: existing } = await supabaseServer
        .from('lang_questions')
        .select('id, question_type, prompt, options, hint, difficulty, order_index')
        .eq('lesson_id', moduleId)
        .order('order_index', { ascending: true });

      if (existing && existing.length > 0) {
        return NextResponse.json({ questions: existing as PlayableQuestion[] });
      }
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let rawText: string;
    try {
      rawText = await callGemini({
        apiKey,
        system: QUESTION_GEN_SYSTEM,
        maxOutputTokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Language: ${lesson.language}
Lesson: ${lesson.title}
Focus area: ${lesson.focus_area}
Lesson content: ${JSON.stringify(lesson.content_json)}

Return ONLY a JSON array of ${QUESTION_COUNT} question objects for this lesson.`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    type RawQuestion = {
      question_type: LangQuestionType;
      prompt: string;
      options: string[] | null;
      correct_answer: string;
      acceptable_answers?: string[];
      explanation?: string;
      hint?: string;
      difficulty?: number;
    };

    let raw: RawQuestion[];
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      raw = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse question data' }, { status: 502 });
    }

    // Validate + drop anything malformed rather than failing the whole batch.
    const validTypes = new Set(['multiple_choice', 'translation', 'fill_blank']);
    const valid = raw.filter((q) => {
      if (!q || typeof q.prompt !== 'string' || !q.prompt.trim()) return false;
      if (!validTypes.has(q.question_type)) return false;
      if (typeof q.correct_answer !== 'string' || !q.correct_answer.trim()) return false;
      if (q.question_type === 'multiple_choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) return false;
        if (!q.options.includes(q.correct_answer)) return false;
      }
      return true;
    });

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid questions generated' }, { status: 502 });
    }

    // Replace any prior set for this lesson when regenerating.
    if (force) {
      await supabaseServer.from('lang_questions').delete().eq('lesson_id', moduleId);
    }

    const inserts = valid.map((q, i) => ({
      user_id: userId,
      lesson_id: moduleId,
      question_type: q.question_type,
      prompt: q.prompt,
      options: q.question_type === 'multiple_choice' ? q.options : null,
      correct_answer: q.correct_answer,
      acceptable_answers: q.acceptable_answers ?? [],
      explanation: q.explanation ?? null,
      hint: q.hint ?? null,
      difficulty: Math.min(5, Math.max(1, q.difficulty ?? 2)),
      order_index: i,
    }));

    const { data: inserted, error: insertError } = await supabaseServer
      .from('lang_questions')
      .insert(inserts)
      .select('id, question_type, prompt, options, hint, difficulty, order_index')
      .order('order_index', { ascending: true });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ questions: inserted as PlayableQuestion[] });
  } catch (err) {
    console.error('Question generation error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
