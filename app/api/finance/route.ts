import { requireUser, unauthorized } from '@/lib/server/auth';
import { loadRules } from '@/lib/server/data';
import { financeSummary } from '@/lib/server/finance';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  const rules = await loadRules(auth.db, auth.userId);
  return Response.json({ summary: await financeSummary(auth.db, auth.userId, rules), rules });
}
