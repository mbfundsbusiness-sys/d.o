'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type ScheduleBlock, type RecurringCommitment } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/provider';
import { ScheduleToday } from '@/components/schedule-today';
import { ScheduleWeekEditor } from '@/components/schedule-week-editor';
import { ScheduleWeekGrid } from '@/components/schedule-week-grid';
import { RecurringCommitmentsEditor } from '@/components/recurring-commitments-editor';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { buildScheduleIcs, downloadIcs } from '@/lib/schedule/ics';
import { regenerateAutoBlocksForDay } from '@/lib/schedule/auto-scheduler';
import { londonNow } from '@/lib/utils/dates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarPlus, List, LayoutGrid, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const VIEW_STORAGE_KEY = 'schedule-view';
type ScheduleView = 'list' | 'grid';

export default function SchedulePage() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [commitments, setCommitments] = useState<RecurringCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ScheduleView>('list');
  const [regenerating, setRegenerating] = useState(false);
  const { settings, loading: settingsLoading } = useUserSettings();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'list' || stored === 'grid') setView(stored);
    } catch {
      // ignore — default to list
    }
  }, []);

  function handleSetView(v: ScheduleView) {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // ignore
    }
  }

  const fetchBlocks = useCallback(async () => {
    const [blocksRes, commitmentsRes] = await Promise.all([
      supabase
        .from('schedule_blocks')
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('recurring_commitments').select('*').order('priority', { ascending: false }),
    ]);
    if (blocksRes.error) setError(blocksRes.error.message);
    else setBlocks(blocksRes.data ?? []);
    if (!commitmentsRes.error) setCommitments(commitmentsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  async function handleRegenerateToday() {
    if (!user) return;
    setRegenerating(true);
    setError(null);
    try {
      const dow = londonNow().dayOfWeek;
      await regenerateAutoBlocksForDay(supabase, user.id, dow);
      await fetchBlocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate schedule');
    } finally {
      setRegenerating(false);
    }
  }

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function handleExportIcs() {
    const ics = buildScheduleIcs(blocks, settings);
    downloadIcs('dedication-optimiser-schedule.ics', ics);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Your weekly routine in Europe/London time. In-app alerts fire 15 minutes before and
            at the start of each block while the app is open.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              onClick={() => handleSetView('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                view === 'list' ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => handleSetView('grid')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                view === 'grid' ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Graph
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleRegenerateToday} disabled={regenerating}>
            {regenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Regenerate today
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportIcs} disabled={blocks.length === 0}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Add to Apple Calendar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <ScheduleToday blocks={blocks} settings={settings} />

      {view === 'grid' ? (
        <ScheduleWeekGrid blocks={blocks} settings={settings} />
      ) : (
        <ScheduleWeekEditor blocks={blocks} settings={settings} onChanged={fetchBlocks} />
      )}

      {user && (
        <RecurringCommitmentsEditor commitments={commitments} userId={user.id} onChanged={fetchBlocks} />
      )}
    </div>
  );
}
