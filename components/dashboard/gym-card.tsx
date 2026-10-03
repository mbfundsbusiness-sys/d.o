'use client';

import { useEffect, useState } from 'react';
import { supabase, type GymSession } from '@/lib/supabase/client';
import { DashCard } from '@/components/ui/glass-card';
import { Dumbbell } from 'lucide-react';

export function GymCard() {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('gym_sessions').select('*').order('started_at', { ascending: false }).limit(1);
      if (error) setError(error.message);
      setSessions(data ?? []);
      setLoading(false);
    })();
  }, []);

  const last = sessions[0];
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = last && last.ended_at && last.started_at.slice(0, 10) === today;

  return (
    <DashCard title="Gym" icon={Dumbbell} href="/app/working?tab=gym" loading={loading} error={error}>
      <div className="space-y-1">
        {doneToday ? (
          <p className="text-sm font-medium">Session logged today{last?.workout_type ? ` — ${last.workout_type}` : ''}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No session logged today yet.</p>
        )}
        {last && !doneToday && (
          <p className="text-xs text-muted-foreground">Last: {new Date(last.started_at).toLocaleDateString('en-GB')}</p>
        )}
      </div>
    </DashCard>
  );
}
