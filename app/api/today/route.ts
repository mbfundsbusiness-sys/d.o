import { describeRules } from '@/lib/rules';
import { requireUser, unauthorized } from '@/lib/server/auth';
import { loadDay, loadRules, openTodos } from '@/lib/server/data';
import { addDaysISO, londonNow } from '@/lib/utils/dates';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth) return unauthorized();
  const now = londonNow();
  const rules = await loadRules(auth.db, auth.userId);
  const [today, tomorrow, todos] = await Promise.all([
    loadDay(auth.db, auth.userId, now.dateISO, rules),
    loadDay(auth.db, auth.userId, addDaysISO(now.dateISO, 1), rules),
    openTodos(auth.db, auth.userId),
  ]);
  return Response.json({ nowMin: now.minutesOfDay, today, tomorrow, todos, rules, rulesText: describeRules(rules) });
}
