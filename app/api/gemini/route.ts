import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text;
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini not configured. Add GEMINI_API_KEY in the environment.' }, { status: 503 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

    const result = await model.generateContent(text);
    const responseText = result.response.text();

    return NextResponse.json({ response: responseText });
  } catch (err) {
    console.error('Gemini API error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
