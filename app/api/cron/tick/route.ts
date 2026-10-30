import { getSupabaseServer } from '@/lib/supabase/server';
import { tickAll } from '@/lib/server/tick';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Hit every 5 minutes by pg_cron (public.ping_app_tick) with the shared secret. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json({ sent: await tickAll(getSupabaseServer()) });
}
