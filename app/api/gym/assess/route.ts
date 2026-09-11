import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { GymEquipment, GymExperienceLevel, GymGoal } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const ASSESS_SYSTEM = `You are a gym training assessment assistant. The user has just set up the gym module in their Dedication Optimiser app. You need to create a concise, personalised summary based on their assessment answers.

You will receive:
- Their goal (strength / hypertrophy / general_fitness / endurance)
- Their experience level (beginner / intermediate / advanced)
- Days per week they can train
- Their available equipment (full_gym / home_dumbbells / bodyweight)
- Any injuries or limitations (optional)

Write a 2-3 sentence summary that:
1. Acknowledges their starting point and goal
2. Reflects their training constraints (days, equipment)
3. Notes any injuries/limitations to work around, if given

Keep it warm but concise. This summary will be stored and used to guide the first week's training plan.`;

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
    const { goal, experience_level, days_per_week, equipment, injuries_notes } = body as {
      goal: GymGoal;
      experience_level: GymExperienceLevel;
      days_per_week: number;
      equipment: GymEquipment;
      injuries_notes?: string;
    };

    if (!goal || !experience_level || !days_per_week || !equipment) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured. Add GEMINI_API_KEY in the secrets panel.' }, { status: 503 });
    }

    // Generate AI summary
    let aiSummary = 'Assessment complete.';
    try {
      aiSummary = await callGemini({
        apiKey,
        system: ASSESS_SYSTEM,
        maxOutputTokens: 256,
        messages: [
          {
            role: 'user',
            content: `Goal: ${goal}\nExperience: ${experience_level}\nDays per week: ${days_per_week}\nEquipment: ${equipment}\nInjuries/limitations: ${injuries_notes || 'None given'}`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
    }

    // One assessment per user — upsert on retake
    const { data: upserted, error: upsertError } = await supabaseServer
      .from('gym_assessments')
      .upsert(
        {
          user_id: userId,
          goal,
          experience_level,
          days_per_week,
          equipment,
          injuries_notes: injuries_notes || null,
          ai_summary: aiSummary,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ assessment: upserted });
  } catch (err) {
    console.error('Gym assessment API error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
