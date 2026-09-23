'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type ReadingSession, type ReadingMaterial, type ReadingHighlight, type CourseLog } from '@/lib/supabase/client';
import { ReadingStats } from '@/components/reading-stats';
import { ReadingMaterialList } from '@/components/reading-material-list';
import { ReadingSessionForm } from '@/components/reading-session-form';
import { ReadingHighlights } from '@/components/reading-highlights';
import { ReadingHistory } from '@/components/reading-history';
import { CoursesList } from '@/components/courses-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTimer } from '@/components/page-timer';
import { Loader2, ChevronDown, ChevronUp, BookOpen, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReadingTab = 'reading' | 'courses';
const TAB_STORAGE_KEY = 'reading-tab';

export default function ReadingPage() {
  const [tab, setTab] = useState<ReadingTab>('reading');
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [materials, setMaterials] = useState<ReadingMaterial[]>([]);
  const [highlights, setHighlights] = useState<ReadingHighlight[]>([]);
  const [courses, setCourses] = useState<CourseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TAB_STORAGE_KEY);
      if (stored === 'reading' || stored === 'courses') setTab(stored);
    } catch {
      // ignore — default to reading
    }
  }, []);

  function handleSetTab(t: ReadingTab) {
    setTab(t);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, t);
    } catch {
      // ignore
    }
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sessRes, matRes, highlightRes, coursesRes] = await Promise.all([
      supabase.from('reading_sessions').select('*').order('started_at', { ascending: false }),
      supabase.from('reading_materials').select('*').order('created_at', { ascending: false }),
      supabase.from('reading_highlights').select('*').order('created_at', { ascending: false }),
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
    ]);
    if (sessRes.error) setError(sessRes.error.message);
    if (matRes.error) setError(matRes.error.message);
    if (highlightRes.error) setError(highlightRes.error.message);
    if (coursesRes.error) setError(coursesRes.error.message);
    setSessions(sessRes.data ?? []);
    setMaterials(matRes.data ?? []);
    setHighlights(highlightRes.data ?? []);
    setCourses(coursesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCount = materials.filter((m) => m.status === 'reading').length;
  const materialTitles = materials.map((m) => m.title);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reading</h1>
          <p className="text-sm text-muted-foreground">
            {tab === 'reading'
              ? "Track what you're reading and log sessions with the universal timer."
              : "Courses you're taking elsewhere — no AI, you add and update these yourself."}
          </p>
        </div>
        {tab === 'reading' && <PageTimer kind="reading" onCompleted={fetchAll} />}
      </div>

      <div className="flex items-center rounded-lg border border-border p-0.5 w-fit">
        <button
          onClick={() => handleSetTab('reading')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'reading' ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <BookOpen className="h-4 w-4" />
          Reading
        </button>
        <button
          onClick={() => handleSetTab('courses')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'courses' ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <GraduationCap className="h-4 w-4" />
          Courses
        </button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {tab === 'reading' ? (
        <>
          <ReadingStats sessions={sessions} activeCount={activeCount} />

          <ReadingMaterialList materials={materials} onChanged={fetchAll} />

          <Card>
            <CardHeader className="pb-3">
              <button
                onClick={() => setShowLogForm((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <CardTitle className="text-lg">Log a session manually</CardTitle>
                {showLogForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CardHeader>
            {showLogForm && (
              <CardContent>
                <ReadingSessionForm onSaved={fetchAll} materialTitles={materialTitles} />
              </CardContent>
            )}
          </Card>

          <ReadingHighlights highlights={highlights} materialTitles={materialTitles} onChanged={fetchAll} />

          <ReadingHistory sessions={sessions} onChanged={fetchAll} />
        </>
      ) : (
        <CoursesList courses={courses} onChanged={fetchAll} />
      )}
    </div>
  );
}
