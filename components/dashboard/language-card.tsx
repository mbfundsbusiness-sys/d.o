'use client';

import { useEffect, useState } from 'react';
import { supabase, type LanguageSession } from '@/lib/supabase/client';
import { DashCard } from '@/components/ui/glass-card';
import { Languages } from 'lucide-react';

export function LanguageCard() {
  const [sessions, setSessions] = useState<LanguageSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data, error } = await supabase.from('language_sessions').select('*').gte('started_at', weekAgo.toISOString()).order('started_at', { ascending: false });
      if (error) setError(error.message);
      setSessions(data ?? []);
      setLoading(false);
    })();
  }, []);

  const last = sessions[0];
  const completedThisWeek = sessions.filter((s) => s.ended_at).length;

  return (
    <DashCard title="Language" icon={Languages} href="/app/learning?tab=language" loading={loading} error={error} empty={sessions.length === 0}>
      <div className="space-y-1">
        {last && <p className="text-sm font-medium">{last.language} · {last.activity_type}</p>}
        <p className="text-xs text-muted-foreground">{completedThisWeek} session{completedThisWeek === 1 ? '' : 's'} this week</p>
      </div>
    </DashCard>
  );
}
