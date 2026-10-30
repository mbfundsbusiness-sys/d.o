import { requireUser, unauthorized } from '@/lib/server/auth';
import { botCouncilStatus } from '@/lib/server/botcouncil';
import { listNotes, withImageLinks } from '@/lib/server/notes';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  const [notes, botcouncil] = await Promise.all([listNotes(auth.db, auth.userId), botCouncilStatus()]);
  return Response.json({ notes: await withImageLinks(auth.db, notes), botcouncil });
}
