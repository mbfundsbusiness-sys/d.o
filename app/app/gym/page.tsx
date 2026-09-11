'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type GymSession, type GymAssessment, type GymPlan, type GymPR } from '@/lib/supabase/client';
import { GymStats } from '@/components/gym-stats';
import { GymAssessmentDialog } from '@/components/gym-assessment-dialog';
import { GymWeekList } from '@/components/gym-week-list';
import { GymWeekDetail } from '@/components/gym-week-detail';
import { GymPRTracker } from '@/components/gym-pr-tracker';
import { GymManualPlanDialog } from '@/components/gym-manual-plan-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Dumbbell, PenLine } from 'lucide-react';

export default function GymPage() {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [assessment, setAssessment] = useState<GymAssessment | null>(null);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [prs, setPrs] = useState<GymPR[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<GymPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showManualPlan, setShowManualPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const hasAutoSelected = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [sessRes, assessRes, plansRes, prsRes] = await Promise.all([
      supabase.from('gym_sessions').select('*').order('started_at', { ascending: false }),
      supabase.from('gym_assessments').select('*').maybeSingle(),
      supabase.from('gym_plans').select('*').order('week_number', { ascending: true }),
      supabase.from('gym_prs').select('*').order('achieved_at', { ascending: false }),
    ]);

    if (sessRes.error) setError(sessRes.error.message);

    setSessions(sessRes.data ?? []);
    setAssessment(assessRes.data ?? null);
    setPlans(plansRes.data ?? []);
    setPrs(prsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!hasAutoSelected.current && plans.length > 0) {
      hasAutoSelected.current = true;
      const latest = plans[plans.length - 1];
      if (!latest.completed) setSelectedPlan(latest);
    }
  }, [plans]);

  async function handleStartAssessment() {
    setShowAssessment(true);
  }

  async function handleAssessmentComplete(newAssessment: GymAssessment) {
    setShowAssessment(false);
    setAssessment(newAssessment);
    setGenerating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/gym/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate plan');

      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate training plan');
    } finally {
      setGenerating(false);
    }
  }

  async function handleWeekCompleted() {
    setSelectedPlan(null);
    await fetchAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const latestPlan = plans[plans.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gym</h1>
        <p className="text-sm text-muted-foreground">
          AI trainer with a personalised weekly plan that adapts to how recovery actually goes.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <GymStats sessions={sessions} />

      {!assessment && plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Dumbbell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Complete a short assessment and the AI trainer will build your first week's plan —
              or write your own week yourself, no AI involved.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleStartAssessment}>
                <Sparkles className="mr-2 h-4 w-4" />
                Start assessment
              </Button>
              <Button variant="outline" onClick={() => setShowManualPlan(true)}>
                <PenLine className="mr-2 h-4 w-4" />
                Write your own week
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : selectedPlan ? (
        <GymWeekDetail
          plan={selectedPlan}
          isLatest={latestPlan?.id === selectedPlan.id}
          onBack={() => setSelectedPlan(null)}
          onWeekCompleted={handleWeekCompleted}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Dumbbell className="h-5 w-5" />
              Training plan
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {plans.filter((p) => p.completed).length} / {plans.length} weeks completed
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowManualPlan(true)}>
                <PenLine className="mr-1 h-3.5 w-3.5" />
                Write a week
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <GymWeekList plans={plans} onSelect={setSelectedPlan} generating={generating} />
          </CardContent>
        </Card>
      )}

      <GymAssessmentDialog
        open={showAssessment}
        onClose={() => setShowAssessment(false)}
        onComplete={handleAssessmentComplete}
      />

      <GymManualPlanDialog
        open={showManualPlan}
        nextWeekNumber={(plans[plans.length - 1]?.week_number ?? 0) + 1}
        onClose={() => setShowManualPlan(false)}
        onSaved={() => {
          setShowManualPlan(false);
          fetchAll();
        }}
      />

      <GymPRTracker prs={prs} onChanged={fetchAll} />
    </div>
  );
}
