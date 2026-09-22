import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { GymPlanContent } from '@/lib/supabase/client';
import { syncGymCommitment, defaultTrainingDays } from '@/lib/gym/schedule-sync';

export const runtime = 'nodejs';

const NEXT_WEEK_SYSTEM = `You are a gym trainer generating the next week of a personalised training plan.

Based on:
- The user's assessment (goal, experience, days per week, equipment, injuries)
- The week they just completed (title, days, exercises)
- Their recovery check-in for that week (soreness, sleep quality, motivation — all 1-5, 5 being best except soreness where 5 is most sore; and a pain flag)
- Sessions they actually logged this week (how many, total time)
- Any PRs they logged recently

Return a JSON object with these fields:
- title: string (e.g. "Week 2 — Progression" or "Week 3 — Deload")
- is_deload: boolean
- intro: string (1-2 sentences on the focus of this week, referencing why if it's a deload)
- days: array, same shape as before — [{ "day_label", "focus", "exercises": [{ "name", "sets", "reps", "rest_sec", "notes" }] }]
- recovery_notes: string

Deload rules (set is_deload: true when ANY of these hold):
- pain_flag is true
- soreness is 5 AND sleep_quality is 1 or 2
- motivation is 1 AND soreness is 4 or 5
- the user logged zero or one sessions against a days_per_week of 3+ (signals burnout, not just a busy week — ease back in rather than pile on)
A deload week should cut volume (sets) by roughly a third to half and drop intensity, while keeping movement patterns familiar.

Progression rules (when NOT a deload):
- If soreness/sleep/motivation were all reasonable (3+) and sessions were mostly completed, progress: add a small amount of volume or intensity versus last week (e.g. +1 set on a couple of lifts, or nudge reps up)
- If PRs were logged, acknowledge the trend and keep pushing that lift's rep range
- Keep exercise variety reasonable — don't overhaul the whole week, evolve it
- Respect equipment and injuries exactly as before

Return ONLY the JSON object, no other text.`;

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
    const { planId } = body as { planId: string };

    if (!planId) {
      return NextResponse.json({ error: 'planId required' }, { status: 400 });
    }

    // Get the completed plan
    const { data: completedPlan } = await supabaseServer
      .from('gym_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!completedPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Get assessment
    const { data: assessment } = await supabaseServer
      .from('gym_assessments')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Get the check-in for this week
    const { data: checkin } = await supabaseServer
      .from('gym_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('week_number', completedPlan.week_number)
      .order('created_at', { ascending: false })
      .maybeSingle();

    // Sessions logged in the last 10 days (rough proxy for "this week")
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const { data: recentSessions } = await supabaseServer
      .from('gym_sessions')
      .select('*')
      .eq('user_id', userId)
      .not('duration_min', 'is', null)
      .gte('started_at', tenDaysAgo.toISOString())
      .order('started_at', { ascending: false });

    // Recent PRs (last 21 days)
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    const { data: recentPRs } = await supabaseServer
      .from('gym_prs')
      .select('*')
      .eq('user_id', userId)
      .gte('achieved_at', threeWeeksAgo.toISOString().slice(0, 10))
      .order('achieved_at', { ascending: false });

    const nextWeekNumber = completedPlan.week_number + 1;

    const sessionsStr = recentSessions && recentSessions.length > 0
      ? `${recentSessions.length} session(s), ${recentSessions.reduce((s: number, x: { duration_min: number | null }) => s + (x.duration_min ?? 0), 0)} total minutes`
      : 'No sessions logged this week.';

    const prsStr = recentPRs && recentPRs.length > 0
      ? recentPRs.map((p: { exercise: string; value: string; achieved_at: string }) => `${p.exercise}: ${p.value} (${p.achieved_at})`).join('\n')
      : 'No PRs logged recently.';

    const checkinStr = checkin
      ? `Soreness: ${checkin.soreness}/5, Sleep quality: ${checkin.sleep_quality}/5, Motivation: ${checkin.motivation}/5, Pain flag: ${checkin.pain_flag}${checkin.notes ? `, Notes: "${checkin.notes}"` : ''}`
      : 'No check-in submitted — assume moderate recovery, no red flags.';

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let rawText: string;
    try {
      rawText = await callGemini({
        apiKey,
        system: NEXT_WEEK_SYSTEM,
        maxOutputTokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Generate week ${nextWeekNumber}.

Assessment:
- Goal: ${assessment?.goal ?? 'general_fitness'}
- Experience: ${assessment?.experience_level ?? 'beginner'}
- Days per week: ${assessment?.days_per_week ?? completedPlan.content_json?.days?.length ?? 3}
- Equipment: ${assessment?.equipment ?? 'full_gym'}
- Injuries/limitations: ${assessment?.injuries_notes || 'None'}

Completed week (${completedPlan.title}):
${JSON.stringify(completedPlan.content_json)}

Recovery check-in:
${checkinStr}

Sessions logged:
${sessionsStr}

Recent PRs:
${prsStr}

Return ONLY the JSON object for week ${nextWeekNumber}.`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    let parsed: { title: string; is_deload?: boolean; intro?: string; days: GymPlanContent['days']; recovery_notes?: string };
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse plan data' }, { status: 502 });
    }

    const contentJson: GymPlanContent = {
      intro: parsed.intro,
      days: parsed.days,
      recovery_notes: parsed.recovery_notes,
    };

    const { data: inserted, error: insertError } = await supabaseServer
      .from('gym_plans')
      .insert({
        user_id: userId,
        week_number: nextWeekNumber,
        title: parsed.title || `Week ${nextWeekNumber}`,
        is_deload: !!parsed.is_deload,
        content_json: contentJson,
        completed: false,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (assessment) {
      const trainingDays = assessment.training_days?.length
        ? assessment.training_days
        : defaultTrainingDays(assessment.days_per_week);
      try {
        await syncGymCommitment(supabaseServer, userId, trainingDays);
      } catch (err) {
        console.error('Failed to sync gym recurring commitment:', err);
      }
    }

    return NextResponse.json({ plan: inserted });
  } catch (err) {
    console.error('Gym next-week error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
