'use client';

import { useEffect, useState } from 'react';
import { supabase, type JobApplication } from '@/lib/supabase/client';
import { formatDateUK } from '@/lib/utils/dates';
import { DashCard } from '@/components/ui/glass-card';
import { Send } from 'lucide-react';

export function JobPipelineCard() {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('job_applications').select('*');
      if (error) setError(error.message);
      setApps(data ?? []);
      setLoading(false);
    })();
  }, []);

  const applied = apps.filter((a) => a.status !== 'researching').length;
  const interview = apps.filter((a) => ['phone_screen', 'interview'].includes(a.status)).length;
  const offer = apps.filter((a) => a.status === 'offer').length;
  const nextFollowUp = apps
    .filter((a) => a.status === 'applied' && !a.follow_up_sent && a.applied_date)
    .sort((a, b) => new Date(a.applied_date!).getTime() - new Date(b.applied_date!).getTime())[0];

  return (
    <DashCard title="Job Pipeline" icon={Send} href="/app/jobs" loading={loading} error={error} empty={apps.length === 0}>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-lg font-semibold tabular-nums">{applied}</p><p className="text-[10px] text-muted-foreground">Applied</p></div>
          <div><p className="text-lg font-semibold tabular-nums">{interview}</p><p className="text-[10px] text-muted-foreground">Interview</p></div>
          <div><p className="text-lg font-semibold tabular-nums">{offer}</p><p className="text-[10px] text-muted-foreground">Offer</p></div>
        </div>
        {nextFollowUp && (
          <p className="text-xs text-muted-foreground">
            Next follow-up: {nextFollowUp.company} (applied {formatDateUK(nextFollowUp.applied_date)})
          </p>
        )}
      </div>
    </DashCard>
  );
}
