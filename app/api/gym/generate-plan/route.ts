import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { GymPlanContent } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const PLAN_GEN_SYSTEM = `You are a gym trainer designing a training week as structured JSON.

Return a JSON object with these fields:
- title: string (short, e.g. "Week 1 — Foundation")
- intro: string (1-2 sentences on the focus of this week)
- days: an array of training days, one per training day requested. Each day:
  { "day_label": string (e.g. "Day 1"), "focus": string (e.g. "Push", "Full Body", "Lower"), "exercises": [{ "name": string, "sets": number, "reps": string (e.g. "8-10" or "AMRAP"), "rest_sec": number, "notes": string (optional form cue) }] }
- recovery_notes: string (brief guidance on recovery for the week)

Rules:
- Generate exactly as many days as the user's days_per_week
- Tailor exercise selection to their equipment (full_gym: barbells/machines/cables fine; home_dumbbells: dumbbell/bodyweight only; bodyweight: no equipment at all)
- Tailor volume and complexity to their experience level (beginner: simpler movements, moderate volume; advanced: higher volume/complexity)
- Tailor exercise selection and rep ranges to their goal (strength: low reps 3-6, longer rest; hypertrophy: moderate reps 8-12; general_fitness: balanced mix; endurance: higher reps 12-20+, shorter rest)
- Respect any injuries/limitations by avoiding or substituting exercises that would aggravate them
- This is week 1 — keep it a sensible, sustainable starting point, not a deload
- Return ONLY the JSON object, no other text`;

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

    // Get assessment
    const { data: assessment } = await supabaseServer
      .from('gym_assessments')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!assessment) {
      return NextResponse.json({ error: 'No assessment found. Complete the assessment first.' }, { status: 400 });
    }

    // Check existing plans
    const { data: existingPlans } = await supabaseServer
      .from('gym_plans')
      .select('week_number')
      .eq('user_id', userId)
      .order('week_number', { ascending: false })
      .limit(1);

    if (existingPlans && existingPlans.length > 0) {
      return NextResponse.json({ error: 'A plan already exists. Complete the current week to generate the next one.' }, { status: 409 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let rawText: string;
    try {
      rawText = await callGemini({
        apiKey,
        system: PLAN_GEN_SYSTEM,
        maxOutputTokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Generate week 1 for:
Goal: ${assessment.goal}
Experience: ${assessment.experience_level}
Days per week: ${assessment.days_per_week}
Equipment: ${assessment.equipment}
Injuries/limitations: ${assessment.injuries_notes || 'None'}

Return ONLY the JSON object for week 1.`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    let parsed: { title: string; intro?: string; days: GymPlanContent['days']; recovery_notes?: string };
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
        week_number: 1,
        title: parsed.title || 'Week 1',
        is_deload: false,
        content_json: contentJson,
        completed: false,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ plan: inserted });
  } catch (err) {
    console.error('Gym plan generation error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
