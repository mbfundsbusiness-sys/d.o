import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';
import type { LanguageLevel, LearningStyle } from '@/lib/supabase/client';

export const runtime = 'nodejs';

const ASSESS_SYSTEM = `You are a language learning assessment assistant. The user has just added a new language to their Dedication Optimiser app. You need to create a concise, personalised summary based on their assessment answers.

You will receive:
- The language
- Their current level (beginner / some_knowledge / conversational)
- Their goal (what progress means for them)
- Their preferred learning style (vocabulary_heavy / grammar_first / conversation_first)

Write a 2-3 sentence summary that:
1. Acknowledges their starting point
2. Reflects their goal in their own words
3. Notes their preferred style

Keep it warm but concise. This summary will be stored and used to guide curriculum generation.`;

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
    const { language, level, goal, style } = body as {
      language: string;
      level: LanguageLevel;
      goal: string;
      style: LearningStyle;
    };

    if (!language || !level || !goal || !style) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    // Check if assessment already exists
    const { data: existing } = await supabaseServer
      .from('language_assessments')
      .select('id')
      .eq('user_id', userId)
      .eq('language', language)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Assessment already exists for this language' }, { status: 409 });
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
            content: `Language: ${language}\nLevel: ${level}\nGoal: ${goal}\nStyle: ${style}`,
          },
        ],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
    }

    const { data: inserted, error: insertError } = await supabaseServer
      .from('language_assessments')
      .insert({
        user_id: userId,
        language,
        level,
        goal,
        style,
        ai_summary: aiSummary,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ assessment: inserted });
  } catch (err) {
    console.error('Assessment API error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
