import { requireUser, unauthorized } from '@/lib/server/auth';
import { morningBrief } from '@/lib/server/brief';
import { londonNow } from '@/lib/utils/dates';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Called when the EA home opens: makes sure today's brief exists. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  // Before 04:00 it's still "last night"; don't plan the new day yet.
  if (londonNow().hour < 4) return Response.json({ created: false });
  try {
    const { created } = await morningBrief(auth.db, auth.userId);
    return Response.json({ created });
  } catch (e) {
    console.error('brief error', e);
    return Response.json({ error: 'Could not write the brief' }, { status: 502 });
  }
}
