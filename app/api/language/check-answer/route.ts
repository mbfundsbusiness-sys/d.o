import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { evaluateAnswer } from '@/lib/language/answer-eval';
import type { AnswerVerdict } from '@/lib/supabase/client';

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
    const { questionId, answer, hintUsed } = body as {
      questionId: string;
      answer: string;
      hintUsed?: boolean;
    };

    if (!questionId || typeof answer !== 'string') {
      return NextResponse.json({ error: 'questionId and answer required' }, { status: 400 });
    }

    const { data: question } = await supabaseServer
      .from('lang_questions')
      .select('*')
      .eq('id', questionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const result = evaluateAnswer(
      answer,
      question.correct_answer,
      (question.acceptable_answers as string[]) ?? [],
      question.question_type
    );

    await supabaseServer.from('lang_question_attempts').insert({
      user_id: userId,
      question_id: questionId,
      lesson_id: question.lesson_id,
      user_answer: answer,
      is_correct: result.correct,
      hint_used: !!hintUsed,
    });

    const verdict: AnswerVerdict = {
      correct: result.correct,
      minorError: result.minorError,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
    };

    return NextResponse.json(verdict);
  } catch (err) {
    console.error('Answer check error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
