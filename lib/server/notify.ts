import type { SupabaseClient } from '@supabase/supabase-js';

// Phone pings go through the same ntfy topic as the database alerts
// (notify_config, service role only), and share notify_log for de-duplication.

export type Ping = { title: string; message: string; tags?: string[]; priority?: 1 | 2 | 3 | 4 | 5 };

export async function ntfyTopic(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from('notify_config').select('topic').eq('id', 1).maybeSingle();
  return data?.topic ?? null;
}

/** Records `key` in notify_log; false if it was already there (already sent). */
export async function claimOnce(db: SupabaseClient, key: string): Promise<boolean> {
  const { error } = await db.from('notify_log').insert({ key });
  return !error;
}

/** Undoes claimOnce so a failed send is retried on the next tick. */
export async function releaseClaim(db: SupabaseClient, key: string): Promise<void> {
  await db.from('notify_log').delete().eq('key', key);
}

export async function sendPing(topic: string, ping: Ping): Promise<boolean> {
  try {
    const res = await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title: ping.title, message: ping.message, tags: ping.tags, priority: ping.priority }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Sends once per key. */
export async function pingOnce(db: SupabaseClient, topic: string, key: string, ping: Ping): Promise<boolean> {
  if (!(await claimOnce(db, key))) return false;
  return sendPing(topic, ping);
}
