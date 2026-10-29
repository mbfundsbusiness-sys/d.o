import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';

export type Authed = { userId: string; db: SupabaseClient };

/** Resolves the Supabase user from the request's bearer token. Every query must still filter by userId. */
export async function requireUser(req: Request): Promise<Authed | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const db = getSupabaseServer();
  const { data, error } = await db.auth.getUser(header.slice('Bearer '.length));
  if (error || !data.user) return null;
  return { userId: data.user.id, db };
}

export const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401 });
