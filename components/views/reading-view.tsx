'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type ReadingSession, type ReadingMaterial, type ReadingHighlight } from '@/lib/supabase/client';
import { ReadingStats } from '@/components/reading-stats';
import { ReadingMaterialList } from '@/components/reading-material-list';
import { ReadingSessionForm } from '@/components/reading-session-form';
import { ReadingHighlights } from '@/components/reading-highlights';
import { ReadingHistory } from '@/components/reading-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTimer } from '@/components/page-timer';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function ReadingView() {
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [materials, setMaterials] = useState<ReadingMaterial[]>([]);
  const [highlights, setHighlights] = useState<ReadingHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sessRes, matRes, highlightRes] = await Promise.all([
      supabase.from('reading_sessions').select('*').order('started_at', { ascending: false }),
      supabase.from('reading_materials').select('*').order('created_at', { ascending: false }),
      supabase.from('reading_highlights').select('*').order('created_at', { ascending: false }),
    ]);
    if (sessRes.error) setError(sessRes.error.message);
    if (matRes.error) setError(matRes.error.message);
    if (highlightRes.error) setError(highlightRes.error.message);
    setSessions(sessRes.data ?? []);
    setMaterials(matRes.data ?? []);
    setHighlights(highlightRes.data ?? []);
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
            "Track what you're reading and log sessions with the universal timer."
          </p>
        </div>
        <PageTimer kind="reading" onCompleted={fetchAll} />
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

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
    </div>
  );
}
