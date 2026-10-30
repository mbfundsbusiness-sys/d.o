import { requireUser, unauthorized } from '@/lib/server/auth';
import { importDocx } from '@/lib/server/notes';

export const runtime = 'nodejs';
// A big notes file with lots of chart screenshots takes a while to unpack.
export const maxDuration = 300;

/** The browser has already uploaded the .docx to the user's folder in the trading-notes bucket. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  if (!path || !/\.docx$/i.test(path)) return Response.json({ error: 'path to an uploaded .docx required' }, { status: 400 });
  try {
    return Response.json(await importDocx(auth.db, auth.userId, path));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
