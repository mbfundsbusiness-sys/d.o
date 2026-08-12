import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const CATEGORISE_SYSTEM = `You are a finance categorisation assistant. The user logs a finance entry with a note. You must return a single short category label.

Categories to choose from:
- food
- transport
- job search
- trading
- rent
- subscriptions
- income
- personal
- other

Rules:
- Return ONLY the category label, nothing else — no explanation, no punctuation, no capitalization
- If the note mentions food, groceries, restaurant, takeaway, coffee → "food"
- If the note mentions bus, train, fuel, uber, taxi, parking → "transport"
- If the note mentions CV, interview, application, job-related expense → "job search"
- If the note mentions trading, chart, platform fee, data feed → "trading"
- If the note mentions rent, deposit, housing → "rent"
- If the note mentions netflix, spotify, subscription, software, app → "subscriptions"
- If the type is "in" and the note mentions salary, wage, payment, income, earned → "income"
- If the note mentions personal, gift, clothes, misc → "personal"
- If unclear → "other"`;

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
    const { amount, type, note, entryDate } = body as {
      amount: number;
      type: 'in' | 'out';
      note?: string;
      entryDate?: string;
    };

    if (!amount || !type) {
      return NextResponse.json({ error: 'Amount and type required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    // Auto-categorise via Anthropic
    const categoriseResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 20,
        system: CATEGORISE_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Type: ${type}\nAmount: ${amount}\nNote: ${note || 'No note provided'}`,
          },
        ],
      }),
    });

    let category = 'other';
    if (categoriseResponse.ok) {
      const data = await categoriseResponse.json();
      const raw = data.content?.[0]?.text?.trim().toLowerCase() ?? '';
      const validCategories = ['food', 'transport', 'job search', 'trading', 'rent', 'subscriptions', 'income', 'personal', 'other'];
      if (validCategories.includes(raw)) {
        category = raw;
      }
    }

    const { data: inserted, error: insertError } = await supabaseServer
      .from('finance_entries')
      .insert({
        user_id: userId,
        entry_date: entryDate || new Date().toISOString().slice(0, 10),
        amount,
        type,
        category,
        note: note || null,
        ai_categorised: true,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ entry: inserted });
  } catch (err) {
    console.error('Finance API error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
