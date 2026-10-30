import { requireUser, unauthorized } from '@/lib/server/auth';
import { scholarshipSummary } from '@/lib/server/scholarship';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  return Response.json({ summary: await scholarshipSummary(auth.db, auth.userId) });
}
