'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type ScheduleBlock } from '@/lib/supabase/client';
import { ScheduleToday } from '@/components/schedule-today';
import { ScheduleWeekEditor } from '@/components/schedule-week-editor';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function SchedulePage() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings, loading: settingsLoading } = useUserSettings();

  const fetchBlocks = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('schedule_blocks')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    if (e) setError(e.message);
    else setBlocks(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Your weekly routine in Europe/London time. In-app alerts fire 15 minutes before and
          at the start of each block while the app is open.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <ScheduleToday blocks={blocks} settings={settings} />
      <ScheduleWeekEditor blocks={blocks} settings={settings} onChanged={fetchBlocks} />
    </div>
  );
}
