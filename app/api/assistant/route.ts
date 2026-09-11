import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are the Dedication Optimiser AI — a personal accountability coach for a 21-year-old rebuilding from zero. The user previously passed £3M in funded trading challenges with £400k live at one point, but those accounts are no longer active. They're currently unemployed, no education program, no car, zero savings, and zero live trading capital. Their top priority is landing an apprenticeship or role in London or within 15 miles west, while maintaining trading discipline and light maintenance on a separate product called BotCouncil.

Your role:
- Be direct, practical, and encouraging without being saccharine
- Reference the user's actual data when relevant — streaks, applications, sessions logged
- Hold them accountable to their 4-phase roadmap (Foundation, Search Sprint, Stabilise, Scale)
- Keep responses concise and actionable — no walls of text
- If they're slipping on discipline, call it out honestly but constructively
- If they're doing well, acknowledge it briefly and push for the next step
- Never give financial advice or trading recommendations — focus on process discipline

You have access to the last 7 days of their data as context. Use it.`;

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
    const userMessage: string = body.message;
    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Pull last 7 days of data for context
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const [anchorLogs, jobApps, tradingSessions, gymSessions, languageSessions, jobSearchSessions, botCouncilChecks, conversationHistory] = await Promise.all([
      supabaseServer.from('anchor_logs').select('*').eq('user_id', userId).gte('created_at', sevenDaysAgoISO).order('log_date', { ascending: false }),
      supabaseServer.from('job_applications').select('*').eq('user_id', userId).gte('created_at', sevenDaysAgoISO).order('updated_at', { ascending: false }),
      supabaseServer.from('trading_sessions').select('*').eq('user_id', userId).gte('started_at', sevenDaysAgoISO).order('started_at', { ascending: false }),
      supabaseServer.from('gym_sessions').select('*').eq('user_id', userId).gte('started_at', sevenDaysAgoISO).order('started_at', { ascending: false }),
      supabaseServer.from('language_sessions').select('*').eq('user_id', userId).gte('started_at', sevenDaysAgoISO).order('started_at', { ascending: false }),
      supabaseServer.from('job_search_sessions').select('*').eq('user_id', userId).gte('started_at', sevenDaysAgoISO).order('started_at', { ascending: false }),
      supabaseServer.from('botcouncil_checks').select('*').eq('user_id', userId).gte('checked_at', sevenDaysAgoISO).order('checked_at', { ascending: false }),
      supabaseServer.from('assistant_conversations').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(20),
    ]);

    // Build context string
    const contextParts: string[] = [];

    if (anchorLogs.data && anchorLogs.data.length > 0) {
      contextParts.push(`=== Daily Anchor Logs (last 7 days) ===\n${anchorLogs.data.map((l: { log_date: string; wake_time: string | null; applications_sent: number; trading_in_plan: boolean; note: string | null }) =>
        `${l.log_date}: wake=${l.wake_time || '—'}, apps=${l.applications_sent}, in_plan=${l.trading_in_plan}${l.note ? `, note="${l.note}"` : ''}`
      ).join('\n')}`);
    }

    if (jobApps.data && jobApps.data.length > 0) {
      contextParts.push(`=== Job Applications (last 7 days) ===\n${jobApps.data.map((a: { company: string; role: string; status: string; location: string | null; applied_date: string | null; follow_up_sent: boolean }) =>
        `${a.company} — ${a.role} (${a.status})${a.location ? `, ${a.location}` : ''}${a.applied_date ? `, applied ${a.applied_date}` : ''}${a.follow_up_sent ? ', followed up' : ''}`
      ).join('\n')}`);
    }

    if (tradingSessions.data && tradingSessions.data.length > 0) {
      const completed = tradingSessions.data.filter((s: { ended_at: string | null }) => s.ended_at);
      contextParts.push(`=== Trading Sessions (last 7 days) ===\n${completed.map((s: { started_at: string; duration_min: number | null; in_plan: boolean; note: string | null }) =>
        `${new Date(s.started_at).toLocaleDateString('en-GB')}: ${s.duration_min}min, in_plan=${s.in_plan}${s.note ? `, note="${s.note}"` : ''}`
      ).join('\n') || 'No completed trading sessions'}`);
    }

    if (gymSessions.data && gymSessions.data.length > 0) {
      const completed = gymSessions.data.filter((s: { ended_at: string | null }) => s.ended_at);
      contextParts.push(`=== Gym Sessions (last 7 days) ===\n${completed.map((s: { started_at: string; duration_min: number | null; workout_type: string | null }) =>
        `${new Date(s.started_at).toLocaleDateString('en-GB')}: ${s.duration_min}min${s.workout_type ? `, ${s.workout_type}` : ''}`
      ).join('\n') || 'No completed gym sessions'}`);
    }

    if (languageSessions.data && languageSessions.data.length > 0) {
      const completed = languageSessions.data.filter((s: { ended_at: string | null }) => s.ended_at);
      contextParts.push(`=== Language Sessions (last 7 days) ===\n${completed.map((s: { started_at: string; duration_min: number | null; language: string; activity_type: string }) =>
        `${new Date(s.started_at).toLocaleDateString('en-GB')}: ${s.language} ${s.activity_type}, ${s.duration_min}min`
      ).join('\n') || 'No completed language sessions'}`);
    }

    if (jobSearchSessions.data && jobSearchSessions.data.length > 0) {
      const completed = jobSearchSessions.data.filter((s: { ended_at: string | null }) => s.ended_at);
      contextParts.push(`=== Job Search Work Blocks (last 7 days) ===\n${completed.map((s: { started_at: string; duration_min: number | null }) =>
        `${new Date(s.started_at).toLocaleDateString('en-GB')}: ${s.duration_min}min`
      ).join('\n') || 'No completed job search blocks'}`);
    }

    if (botCouncilChecks.data && botCouncilChecks.data.length > 0) {
      contextParts.push(`=== BotCouncil Checks (last 7 days) ===\n${botCouncilChecks.data.map((c: { checked_at: string; status: string; note: string | null }) =>
        `${new Date(c.checked_at).toLocaleDateString('en-GB')}: ${c.status}${c.note ? `, note="${c.note}"` : ''}`
      ).join('\n')}`);
    }

    const contextStr = contextParts.length > 0
      ? `\n\n--- USER DATA (last 7 days) ---\n${contextParts.join('\n\n')}\n--- END USER DATA ---\n`
      : '\n\n--- USER DATA (last 7 days) ---\nNo activity logged in the last 7 days.\n--- END USER DATA ---\n';

    // Build conversation messages for Anthropic
    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    if (conversationHistory.data) {
      for (const msg of conversationHistory.data) {
        historyMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI assistant not configured. Add GEMINI_API_KEY in the secrets panel.' }, { status: 503 });
    }

    let assistantContent: string;
    try {
      assistantContent = await callGemini({
        apiKey,
        system: SYSTEM_PROMPT + contextStr,
        messages: [
          ...historyMessages,
          { role: 'user' as const, content: userMessage },
        ],
        maxOutputTokens: 1024,
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    // Persist both messages
    await supabaseServer.from('assistant_conversations').insert([
      { user_id: userId, role: 'user', content: userMessage },
      { user_id: userId, role: 'assistant', content: assistantContent },
    ]);

    return NextResponse.json({ response: assistantContent });
  } catch (err) {
    console.error('Assistant API error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
