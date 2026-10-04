'use client';

import { useEffect, useState } from 'react';
import { supabase, type BotCouncilCheck, type BotCouncilTask } from '@/lib/supabase/client';
import { DashCard } from '@/components/ui/glass-card';
import { Bot } from 'lucide-react';

export function BotCouncilCard() {
  const [checks, setChecks] = useState<BotCouncilCheck[]>([]);
  const [tasks, setTasks] = useState<BotCouncilTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [checksRes, tasksRes] = await Promise.all([
        supabase.from('botcouncil_checks').select('*').order('checked_at', { ascending: false }).limit(3),
        supabase.from('botcouncil_tasks').select('*').eq('completed', false),
      ]);
      if (checksRes.error) setError(checksRes.error.message);
      setChecks(checksRes.data ?? []);
      setTasks(tasksRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <DashCard title="BotCouncil" icon={Bot} href="/app/working?tab=botcouncil" loading={loading} error={error} empty={checks.length === 0}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ul className="space-y-1">
          {checks.map((c) => (
            <li key={c.id} className="text-xs text-muted-foreground">
              {new Date(c.checked_at).toLocaleDateString('en-GB')} — {c.status}{c.note ? `: ${c.note}` : ''}
            </li>
          ))}
        </ul>
        <span className="text-xs font-medium text-muted-foreground">{tasks.length} open task{tasks.length === 1 ? '' : 's'}</span>
      </div>
    </DashCard>
  );
}
