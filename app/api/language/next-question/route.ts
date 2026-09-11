import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getGeminiApiKey } from '@/lib/gemini';
import { generateOneQuestion } from '@/lib/language/question-gen';
import { getAbility, difficultyFromAbility, getDifficultyTrend } from '@/lib/language/ability';
import type { PlayableQuestion, NextQuestionResponse } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const LESSON_QUESTION_COUNT = 8;

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
    const { moduleId, reset } = body as { moduleId: string; reset?: boolean };
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId required' }, { status: 400 });
    }

    if (reset) {
      // "Practice again" after a failed attempt — clear this lesson's question
      // set (attempts cascade-delete with it) and start over. Ability persists.
      await supabaseServer.from('lang_questions').delete().eq('lesson_id', moduleId).eq('user_id', userId);
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

    const ability = await getAbility(supabaseServer, userId, lesson.language, lesson.focus_area);

    // Existing questions for this lesson (persist across refresh/resume).
    const { data: existing } = await supabaseServer
      .from('lang_questions')
      .select('id, question_type, prompt, options, hint, difficulty, order_index, correct_answer')
      .eq('lesson_id', moduleId)
      .order('order_index', { ascending: true });

    const questions = existing ?? [];

    const { data: attempts } = await supabaseServer
      .from('lang_question_attempts')
      .select('question_id')
      .eq('lesson_id', moduleId);

    const answeredIds = new Set((attempts ?? []).map((a) => a.question_id));
    const answeredCount = questions.filter((q) => answeredIds.has(q.id)).length;

    // Resume: an already-generated question hasn't been answered yet.
    const unanswered = questions.find((q) => !answeredIds.has(q.id));
    if (unanswered) {
      const response: NextQuestionResponse = {
        question: sanitize(unanswered),
        done: false,
        totalCount: LESSON_QUESTION_COUNT,
        answeredCount,
        ability,
      };
      return NextResponse.json(response);
    }

    if (questions.length >= LESSON_QUESTION_COUNT) {
      const { data: allAttempts } = await supabaseServer
        .from('lang_question_attempts')
        .select('is_correct')
        .eq('lesson_id', moduleId);
      const correctCount = (allAttempts ?? []).filter((a) => a.is_correct).length;

      const response: NextQuestionResponse = {
        question: null,
        done: true,
        totalCount: LESSON_QUESTION_COUNT,
        answeredCount,
        correctCount,
        ability,
      };
      return NextResponse.json(response);
    }

    // Generate the next question, anchored on the last one's difficulty
    // (or the ability-derived starting difficulty if this is the first).
    const lastDifficulty = questions.length > 0 ? questions[questions.length - 1].difficulty : difficultyFromAbility(ability);
    const trend = await getDifficultyTrend(supabaseServer, moduleId);
    let targetDifficulty = lastDifficulty;
    if (trend === 'up') targetDifficulty = Math.min(5, lastDifficulty + 1);
    if (trend === 'down') targetDifficulty = Math.max(1, lastDifficulty - 1);

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let raw;
    try {
      raw = await generateOneQuestion({
        apiKey,
        language: lesson.language,
        lessonTitle: lesson.title,
        focusArea: lesson.focus_area,
        contentJson: lesson.content_json,
        difficulty: targetDifficulty,
        avoidPrompts: questions.map((q) => q.prompt),
      });
    } catch (err) {
      console.error('Question generation error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    const { data: inserted, error: insertError } = await supabaseServer
      .from('lang_questions')
      .insert({
        user_id: userId,
        lesson_id: moduleId,
        question_type: raw.question_type,
        prompt: raw.prompt,
        options: raw.question_type === 'multiple_choice' ? raw.options : null,
        correct_answer: raw.correct_answer,
        acceptable_answers: raw.acceptable_answers ?? [],
        explanation: raw.explanation ?? null,
        hint: raw.hint ?? null,
        difficulty: targetDifficulty,
        order_index: questions.length,
      })
      .select('id, question_type, prompt, options, hint, difficulty, order_index')
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message || 'Failed to save question' }, { status: 500 });
    }

    const response: NextQuestionResponse = {
      question: inserted as PlayableQuestion,
      done: false,
      totalCount: LESSON_QUESTION_COUNT,
      answeredCount,
      ability,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('Next-question error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

function sanitize(q: { id: string; question_type: string; prompt: string; options: unknown; hint: string | null; difficulty: number; order_index: number }): PlayableQuestion {
  return {
    id: q.id,
    question_type: q.question_type as PlayableQuestion['question_type'],
    prompt: q.prompt,
    options: (q.options as string[] | null) ?? null,
    hint: q.hint,
    difficulty: q.difficulty,
    order_index: q.order_index,
  };
}
