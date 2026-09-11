import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { applyReview, initialMastery } from '@/lib/language/mastery';
import type { LangConceptMastery } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const PASS_THRESHOLD = 0.7;

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
    const { lessonId, accuracy } = body as { lessonId: string; accuracy: number };

    if (!lessonId || typeof accuracy !== 'number') {
      return NextResponse.json({ error: 'lessonId and accuracy required' }, { status: 400 });
    }

    const { data: existing } = await supabaseServer
      .from('lang_concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    const passed = accuracy >= PASS_THRESHOLD;
    const update = existing
      ? applyReview(existing, passed)
      : initialMastery(accuracy); // defensive: shouldn't normally happen

    const row = {
      user_id: userId,
      lesson_id: lessonId,
      mastery: update.mastery,
      successful_recalls: update.successfulRecalls,
      interval_days: update.intervalDays,
      last_reviewed_at: new Date().toISOString(),
      next_review_at: update.nextReviewAt,
    };

    const { data: saved, error: upsertError } = await supabaseServer
      .from('lang_concept_mastery')
      .upsert(row, { onConflict: 'user_id,lesson_id' })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ mastery: saved as LangConceptMastery, passed });
  } catch (err) {
    console.error('Review result error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
