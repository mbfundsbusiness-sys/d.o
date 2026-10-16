'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Save, Briefcase } from 'lucide-react';
import { supabase, DEFAULT_SHIFT_TITLE, type WorkShift } from '@/lib/supabase/client';
import { addDaysISO, fmtHM, todayISO } from '@/lib/utils/dates';
import { fetchShifts, mondayOf, validateShiftTimes, weekDates } from '@/lib/schedule/shifts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Row = { start: string; end: string };

function dayLabel(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Rotating-rota entry: pick a week, type start/end for each day you're working
 * (blank = day off), save. Shifts are dated rows in work_shifts, not part of the
 * weekly template.
 */
export function ShiftsEditor({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const [monday, setMonday] = useState(() => mondayOf(todayISO()));
  const [title, setTitle] = useState(DEFAULT_SHIFT_TITLE);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [existing, setExisting] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dates = useMemo(() => weekDates(monday), [monday]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const shifts = await fetchShifts(dates[0], dates[6]);
    setExisting(shifts);
    const next: Record<string, Row> = {};
    for (const d of dates) next[d] = { start: '', end: '' };
    for (const s of shifts) next[s.shift_date] = { start: fmtHM(s.start_time), end: fmtHM(s.end_time) };
    setRows(next);
    if (shifts[0]?.title) setTitle(shifts[0].title);
    setLoading(false);
  }, [dates]);

  useEffect(() => {
    void load();
  }, [load]);

  function setRow(date: string, patch: Partial<Row>) {
    setSaved(false);
    setRows((r) => ({ ...r, [date]: { ...r[date], ...patch } }));
  }

  async function save() {
    setError(null);
    const inserts: { user_id: string; shift_date: string; start_time: string; end_time: string; title: string }[] = [];
    for (const d of dates) {
      const r = rows[d];
      if (!r || (!r.start && !r.end)) continue;
      const problem = validateShiftTimes(r.start, r.end);
      if (problem) {
        setError(`${dayLabel(d)}: ${problem}`);
        return;
      }
      inserts.push({ user_id: userId, shift_date: d, start_time: r.start, end_time: r.end, title: title.trim() || DEFAULT_SHIFT_TITLE });
    }

    setSaving(true);
    // Insert the new rows first, then remove the previous ones, so a failed
    // save can never leave the week empty.
    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from('work_shifts').insert(inserts);
      if (insErr) {
        setError(insErr.message);
        setSaving(false);
        return;
      }
    }
    const oldIds = existing.map((s) => s.id);
    if (oldIds.length > 0) {
      const { error: delErr } = await supabase.from('work_shifts').delete().in('id', oldIds);
      if (delErr) {
        setError(`Saved, but could not clear the old shifts: ${delErr.message}`);
        setSaving(false);
        await load();
        return;
      }
    }
    setSaving(false);
    setSaved(true);
    await load();
    onChanged?.();
  }

  function copyFromPreviousWeek() {
    void (async () => {
      const prev = await fetchShifts(addDaysISO(monday, -7), addDaysISO(monday, -1));
      setRows((r) => {
        const next = { ...r };
        for (const s of prev) {
          const target = addDaysISO(s.shift_date, 7);
          if (next[target]) next[target] = { start: fmtHM(s.start_time), end: fmtHM(s.end_time) };
        }
        return next;
      });
      setSaved(false);
    })();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-4 w-4" /> Work shifts
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setMonday(addDaysISO(monday, -7))} aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[9rem] text-center text-sm tabular-nums">
              {dayLabel(dates[0])} – {dayLabel(dates[6])}
            </span>
            <Button variant="outline" size="icon" onClick={() => setMonday(addDaysISO(monday, 7))} aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {dates.map((d, i) => (
                <div key={d} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-sm">
                    <span className="font-medium">{DAY[i]}</span>{' '}
                    <span className="text-xs text-muted-foreground">{dayLabel(d)}</span>
                  </span>
                  <Input
                    type="time"
                    aria-label={`${DAY[i]} shift start`}
                    value={rows[d]?.start ?? ''}
                    onChange={(e) => setRow(d, { start: e.target.value })}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    aria-label={`${DAY[i]} shift end`}
                    value={rows[d]?.end ?? ''}
                    onChange={(e) => setRow(d, { end: e.target.value })}
                    className="w-28"
                  />
                  {!rows[d]?.start && !rows[d]?.end && <span className="text-xs text-muted-foreground">off</span>}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs" aria-label="Shift title" />
              <Button variant="outline" size="sm" onClick={copyFromPreviousWeek}>
                Copy last week
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save week
              </Button>
              {saved && <span className="text-xs text-muted-foreground">Saved</span>}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Leave a day blank for no shift. Shifts show on your schedule and clash-check against lectures; the shift always wins.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
