'use client';

import { useState, FormEvent } from 'react';
import { supabase, type CourseLog } from '@/lib/supabase/client';
import { useTimer } from '@/lib/timer/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DeleteButton } from '@/components/delete-button';
import { Loader2, Plus, Play, Check, RotateCcw } from 'lucide-react';

export function CoursesList({ courses, onChanged }: { courses: CourseLog[]; onChanged: () => void }) {
  const { running, startSession } = useTimer();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [moduleLesson, setModuleLesson] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);

    const { error: insErr } = await supabase.from('courses').insert({
      title: title.trim(),
      platform: platform.trim() || null,
      module_lesson: moduleLesson.trim() || null,
      notes: notes.trim() || null,
    });

    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setTitle('');
    setPlatform('');
    setModuleLesson('');
    setNotes('');
    setShowAdd(false);
    onChanged();
  }

  async function updateProgress(course: CourseLog, progress: number) {
    setBusyId(course.id);
    const { error: updErr } = await supabase
      .from('courses')
      .update({ progress_percent: progress })
      .eq('id', course.id);
    if (updErr) setError(updErr.message);
    setBusyId(null);
    onChanged();
  }

  async function toggleStatus(course: CourseLog) {
    setBusyId(course.id);
    const nowCompleted = course.status !== 'completed';
    const { error: updErr } = await supabase
      .from('courses')
      .update({ status: nowCompleted ? 'completed' : 'active', progress_percent: nowCompleted ? 100 : course.progress_percent })
      .eq('id', course.id);
    if (updErr) setError(updErr.message);
    setBusyId(null);
    onChanged();
  }

  async function handleDelete(id: string) {
    await supabase.from('courses').delete().eq('id', id);
    onChanged();
  }

  async function startTimer(course: CourseLog) {
    setError(null);
    try {
      await startSession('course', { course_name: course.title });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start timer');
    }
  }

  const active = courses.filter((c) => c.status === 'active');
  const completed = courses.filter((c) => c.status === 'completed');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">My courses</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          Add course
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="course-title" className="text-xs">Course</Label>
                <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="course-platform" className="text-xs">Platform</Label>
                <Input id="course-platform" placeholder="e.g. Skool.com" value={platform} onChange={(e) => setPlatform(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="course-module" className="text-xs">Current module/lesson</Label>
                <Input id="course-module" value={moduleLesson} onChange={(e) => setModuleLesson(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="course-notes" className="text-xs">Notes (optional)</Label>
                <Textarea id="course-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving || !title.trim()}>
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Add
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!error && courses.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground">No courses logged yet.</p>
        )}

        {active.length > 0 && (
          <div className="space-y-2">
            {active.map((course) => {
              const timerRunning = running?.kind === 'course' && running.course_name === course.title;
              return (
                <div key={course.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{course.title}</span>
                        {course.platform && (
                          <span className="text-xs text-muted-foreground">{course.platform}</span>
                        )}
                      </div>
                      {course.module_lesson && (
                        <p className="text-xs text-muted-foreground">{course.module_lesson}</p>
                      )}
                      {course.notes && <p className="mt-1 text-xs text-muted-foreground">{course.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" disabled={!!running} onClick={() => startTimer(course)}>
                        <Play className="mr-1 h-3.5 w-3.5" />
                        {timerRunning ? 'Running' : 'Timer'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === course.id} onClick={() => toggleStatus(course)}>
                        {busyId === course.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <DeleteButton onDelete={() => handleDelete(course.id)} confirmText={`Delete "${course.title}"?`} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Label htmlFor={`progress-${course.id}`} className="text-xs text-muted-foreground">
                      Progress
                    </Label>
                    <Input
                      id={`progress-${course.id}`}
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={course.progress_percent}
                      className="h-8 w-20 text-xs"
                      onBlur={(e) => {
                        const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                        if (v !== course.progress_percent) updateProgress(course, v);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <div className="ml-2 h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground/60" style={{ width: `${course.progress_percent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {completed.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
            {completed.map((course) => (
              <div key={course.id} className="flex items-center justify-between rounded-lg border border-border p-3 opacity-60">
                <div>
                  <span className="text-sm font-medium line-through">{course.title}</span>
                  {course.platform && <span className="ml-2 text-xs text-muted-foreground">{course.platform}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" disabled={busyId === course.id} onClick={() => toggleStatus(course)}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Reopen
                  </Button>
                  <DeleteButton onDelete={() => handleDelete(course.id)} confirmText={`Delete "${course.title}"?`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
