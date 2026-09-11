import { NextRequest, NextResponse } from 'next/server';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getGeminiApiKey } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANALYSIS_SYSTEM = `You are a music analyst helping a songwriter capture the sonic character of a reference track for their own style profile.

Listen to the audio and describe:
- Genre and subgenre
- Overall mood/energy (e.g. moody, euphoric, aggressive, wistful)
- Tempo and rhythmic feel (e.g. laid-back, driving, syncopated)
- Instrumentation and production style (e.g. sparse, layered, lo-fi, polished, specific instruments you can hear)
- Vocal style and delivery, if vocals are present (e.g. breathy, belted, rap-sung, harmonized) — describe the STYLE of delivery only
- Structure/arrangement if apparent (e.g. builds slowly, hook-heavy, verse-heavy)

Strict rules:
- Do NOT transcribe or quote any lyrics, even partially. Never reproduce words the vocalist sings.
- Do NOT identify the song or artist by name even if you recognise it — describe only what you hear.
- Write 3-5 sentences, dense with concrete sonic detail, no filler.`;

export async function POST(req: NextRequest) {
  let uploadedFileName: string | null = null;

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

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    const formData = await req.formData();
    const file = formData.get('audio');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 });
    }

    const MAX_BYTES = 100 * 1024 * 1024; // 100MB — generous for a single track
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });
    }

    const mimeType = file.type || 'audio/mpeg';
    const buffer = Buffer.from(await file.arrayBuffer());

    const fileManager = new GoogleAIFileManager(apiKey);
    const uploadResult = await fileManager.uploadFile(buffer, {
      mimeType,
      displayName: file.name || 'reference-track',
    });
    uploadedFileName = uploadResult.file.name;

    // Gemini processes uploaded audio asynchronously — poll until ACTIVE.
    let fileInfo = uploadResult.file;
    const start = Date.now();
    while (fileInfo.state === FileState.PROCESSING && Date.now() - start < 50_000) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileInfo = await fileManager.getFile(uploadedFileName);
    }

    if (fileInfo.state !== FileState.ACTIVE) {
      return NextResponse.json({ error: 'Audio processing failed or timed out' }, { status: 502 });
    }

    // gemini-flash-lite-latest's multimodal (audio) path is heavily
    // congested on the free tier (persistent 503s) — gemini-3.6-flash
    // handles audio reliably. It has a tighter daily quota, but audio
    // uploads are far less frequent than chat messages, so that's fine here.
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: ANALYSIS_SYSTEM,
    });

    const contentParts = [
      { fileData: { mimeType: fileInfo.mimeType, fileUri: fileInfo.uri } },
      { text: 'Analyze this track.' },
    ];

    // Transient 503s ("high demand") are common on this model — retry twice
    // with backoff before giving up.
    let analysis: string | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent(contentParts);
        analysis = result.response.text();
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
    if (analysis === null) throw lastErr;

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error('Ghostwriter audio analysis error:', err);
    return NextResponse.json({ error: 'Something went wrong analyzing the audio' }, { status: 500 });
  } finally {
    if (uploadedFileName) {
      try {
        const apiKey = getGeminiApiKey();
        if (apiKey) {
          const fileManager = new GoogleAIFileManager(apiKey);
          await fileManager.deleteFile(uploadedFileName);
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up uploaded audio file:', cleanupErr);
      }
    }
  }
}
