import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { callGemini, getGeminiApiKey } from '@/lib/gemini';

export const runtime = 'nodejs';

const BASE_SYSTEM = `You are a ghostwriter and songwriting collaborator. Your job is to help the user write lyrics that sound like THEM — not a generic AI voice.

You have their style profile below: past lyrics they've written (study the vocabulary, themes, rhyme schemes, line lengths, structure, tone) and reference tracks they've described (the sound/mood/genre they're chasing for this song).

Your role:
- Match their established voice — don't drift into generic pop-lyric clichés unless that's genuinely their style
- Suggest lines, verses, hooks, structure — whatever they ask for
- When you propose lyrics, write them out clearly (use line breaks, label sections like [Verse 1], [Chorus] when useful)
- Ask clarifying questions when the brief is vague, but don't stall — give them something to react to
- Be a collaborator, not just a generator: reference specific things from their style profile when relevant
- Keep responses focused — don't pad with generic encouragement`;

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
    const { message, songId } = body as { message: string; songId: string };

    if (!message || !songId) {
      return NextResponse.json({ error: 'message and songId required' }, { status: 400 });
    }

    const { data: song } = await supabaseServer
      .from('ghostwriter_songs')
      .select('*')
      .eq('id', songId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const [styleLyricsRes, referencesRes, historyRes] = await Promise.all([
      supabaseServer.from('ghostwriter_style_lyrics').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabaseServer.from('ghostwriter_references').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabaseServer.from('ghostwriter_chat_messages').select('*').eq('song_id', songId).order('created_at', { ascending: true }).limit(30),
    ]);

    const styleLyrics = styleLyricsRes.data ?? [];
    const references = referencesRes.data ?? [];
    const history = historyRes.data ?? [];

    const styleLyricsStr = styleLyrics.length > 0
      ? styleLyrics.map((l: { title: string; lyrics_text: string; notes: string | null }) =>
          `--- "${l.title}" ${l.notes ? `(${l.notes})` : ''} ---\n${l.lyrics_text}`
        ).join('\n\n')
      : 'No past lyrics provided yet — write in a natural, versatile style until you learn more.';

    const referencesStr = references.length > 0
      ? references.map((r: { artist: string | null; track: string | null; description: string }) =>
          `${r.artist || 'Unknown artist'}${r.track ? ` — "${r.track}"` : ''}: ${r.description}`
        ).join('\n')
      : 'No reference tracks given.';

    const songContextStr = `Song: "${song.title}"${song.brief ? `\nBrief: ${song.brief}` : ''}\n\nCurrent lyrics draft:\n${song.lyrics_text?.trim() || '(empty — nothing written yet)'}`;

    const systemPrompt = `${BASE_SYSTEM}

=== USER'S STYLE PROFILE ===

Past lyrics:
${styleLyricsStr}

Reference tracks (sound/mood they're going for):
${referencesStr}

=== CURRENT SONG ===

${songContextStr}`;

    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = history.map(
      (m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content })
    );

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    let assistantContent: string;
    try {
      assistantContent = await callGemini({
        apiKey,
        system: systemPrompt,
        maxOutputTokens: 1536,
        messages: [...historyMessages, { role: 'user' as const, content: message }],
      });
    } catch (err) {
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    await supabaseServer.from('ghostwriter_chat_messages').insert([
      { user_id: userId, song_id: songId, role: 'user', content: message },
      { user_id: userId, song_id: songId, role: 'assistant', content: assistantContent },
    ]);

    return NextResponse.json({ response: assistantContent });
  } catch (err) {
    console.error('Ghostwriter chat error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
