'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type JobApplication } from '@/lib/supabase/client';
import { PageShell } from '@/components/ui/page-shell';
import { StatCard } from '@/components/ui/stat-card';
import { JobPipeline } from '@/components/job-pipeline';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Send, PhoneCall, Trophy, Clock } from 'lucide-react';

export default function JobsPage() {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('job_applications').select('*').order('updated_at', { ascending: false });
    if (error) setError(error.message);
    setApps(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const applied = apps.filter((a) => a.status !== 'researching').length;
  const interviews = apps.filter((a) => ['phone_screen', 'interview'].includes(a.status)).length;
  const offers = apps.filter((a) => a.status === 'offer').length;
  const needsFollowUp = apps.filter((a) => {
    if (a.status !== 'applied' || a.follow_up_sent || !a.applied_date) return false;
    const days = (Date.now() - new Date(a.applied_date).getTime()) / 86400000;
    return days >= 5;
  }).length;

  return (
    <PageShell title="Job Pipeline" subtitle="Every application, tracked from research through offer.">
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Applied" value={`${applied}`} icon={Send} />
            <StatCard label="Interviewing" value={`${interviews}`} icon={PhoneCall} />
            <StatCard label="Offers" value={`${offers}`} icon={Trophy} />
            <StatCard label="Needs follow-up" value={`${needsFollowUp}`} icon={Clock} />
          </div>
          <JobPipeline apps={apps} onChanged={fetchAll} />
        </>
      )}
    </PageShell>
  );
}
