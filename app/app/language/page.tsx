'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type LanguageSession, type LanguageAssessment, type LanguageModule, type LangUnit, type LangLessonGroup, type LangConceptMastery } from '@/lib/supabase/client';
import { LanguageStats } from '@/components/language-stats';
import { LanguageHistory } from '@/components/language-history';
import { LanguageForm } from '@/components/language-session-form';
import { AssessmentDialog } from '@/components/language-assessment-dialog';
import { LanguageLearningPath } from '@/components/language-learning-path';
import { ModuleDetail } from '@/components/language-module-detail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Sparkles, BookOpen, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { DeleteButton } from '@/components/delete-button';
import { formatDateUK } from '@/lib/utils/dates';

const COMMON_LANGUAGES = ['Spanish', 'French', 'German', 'Arabic', 'Japanese', 'Mandarin', 'Italian', 'Portuguese'];

export default function LanguagePage() {
  const [sessions, setSessions] = useState<LanguageSession[]>([]);
  const [assessments, setAssessments] = useState<LanguageAssessment[]>([]);
  const [modules, setModules] = useState<LanguageModule[]>([]);
  const [units, setUnits] = useState<LangUnit[]>([]);
  const [lessonGroups, setLessonGroups] = useState<LangLessonGroup[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<LanguageModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState('Spanish');
  const [customLanguage, setCustomLanguage] = useState('');
  const [showLogForm, setShowLogForm] = useState(false);
  const [dueReviews, setDueReviews] = useState<{ lesson: LanguageModule; mastery: LangConceptMastery }[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [sessRes, assessRes] = await Promise.all([
      supabase.from('language_sessions').select('*').order('started_at', { ascending: false }),
      supabase.from('language_assessments').select('*').order('created_at', { ascending: false }),
    ]);

    if (sessRes.error) setError(sessRes.error.message);
    if (assessRes.error && !assessRes.error.message.includes('No rows')) {
      // assessments might not exist yet, that's fine
    }

    setSessions(sessRes.data ?? []);
    setAssessments(assessRes.data ?? []);
    setLoading(false);
  }, []);

  const fetchModules = useCallback(async (language: string) => {
    const [modulesRes, unitsRes, groupsRes] = await Promise.all([
      supabase.from('language_modules').select('*').eq('language', language).order('module_number', { ascending: true }),
      supabase.from('lang_units').select('*').eq('language', language).order('unit_number', { ascending: true }),
      supabase.from('lang_lesson_groups').select('*').eq('language', language).order('group_number', { ascending: true }),
    ]);

    if (modulesRes.error) setError(modulesRes.error.message);
    setModules(modulesRes.data ?? []);
    setUnits(unitsRes.data ?? []);
    setLessonGroups(groupsRes.data ?? []);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (selectedLanguage) {
      fetchModules(selectedLanguage);
      setSelectedModule(null);
    } else {
      setModules([]);
      setUnits([]);
      setLessonGroups([]);
    }
  }, [selectedLanguage, fetchModules]);

  // Auto-select first assessed language
  useEffect(() => {
    if (!selectedLanguage && assessments.length > 0) {
      setSelectedLanguage(assessments[0].language);
    }
  }, [assessments, selectedLanguage]);

  // Which completed lessons are due for spaced-repetition review right now.
  useEffect(() => {
    const completedIds = modules.filter((m) => m.completed).map((m) => m.id);
    if (completedIds.length === 0) {
      setDueReviews([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('lang_concept_mastery')
        .select('*')
        .in('lesson_id', completedIds)
        .lte('next_review_at', new Date().toISOString())
        .order('next_review_at', { ascending: true });

      if (cancelled) return;
      const byId = new Map(modules.map((m) => [m.id, m]));
      const due = (data ?? [])
        .map((m: LangConceptMastery) => ({ lesson: byId.get(m.lesson_id), mastery: m }))
        .filter((r): r is { lesson: LanguageModule; mastery: LangConceptMastery } => !!r.lesson);
      setDueReviews(due);
    })();
    return () => {
      cancelled = true;
    };
  }, [modules]);

  async function handleAddLanguage() {
    const lang = customLanguage.trim() || newLanguage;
    if (!lang) return;

    // Check if already assessed
    const existing = assessments.find((a) => a.language.toLowerCase() === lang.toLowerCase());
    if (existing) {
      setSelectedLanguage(existing.language);
      setShowAddLanguage(false);
      setCustomLanguage('');
      return;
    }

    setSelectedLanguage(lang);
    setShowAddLanguage(false);
    setShowAssessment(true);
  }

  async function generateModulesFor(language: string) {
    setGenerating(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/language/generate-modules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ language, count: 4 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate modules');

      await fetchModules(language);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate curriculum');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAssessmentComplete(_assessment: LanguageAssessment) {
    setShowAssessment(false);

    // Refresh assessments
    const { data: newAssessments } = await supabase
      .from('language_assessments')
      .select('*')
      .order('created_at', { ascending: false });
    setAssessments(newAssessments ?? []);

    await generateModulesFor(_assessment.language);
  }

  async function handleRemoveLanguage(language: string) {
    await supabase.from('language_modules').delete().eq('language', language);
    await supabase.from('lang_units').delete().eq('language', language);
    await supabase.from('lang_skill_ability').delete().eq('language', language);
    await supabase.from('language_assessments').delete().eq('language', language);
    if (selectedLanguage === language) setSelectedLanguage(null);
    await fetchAll();
  }

  async function handleModuleCompleted() {
    if (selectedLanguage) {
      await fetchModules(selectedLanguage);
    }
    setSelectedModule(null);
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Language Learning</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered tutor with personalised curriculum, adaptive modules, and tutor chat.
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Language selector + add */}
      <div className="flex flex-wrap items-center gap-2">
        {assessments.map((a) => (
          <div key={a.id} className="relative">
            <Button
              variant={selectedLanguage === a.language ? 'default' : 'outline'}
              size="sm"
              className="pr-7"
              onClick={() => setSelectedLanguage(a.language)}
            >
              {a.language}
            </Button>
            <DeleteButton
              onDelete={() => handleRemoveLanguage(a.language)}
              confirmText={`Remove ${a.language}? This deletes its whole curriculum and progress.`}
              className="absolute right-0.5 top-1/2 -translate-y-1/2"
            />
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddLanguage(!showAddLanguage)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add language
        </Button>
      </div>

      {/* Add language inline form */}
      {showAddLanguage && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:w-48">
              <Select value={newLanguage} onValueChange={setNewLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Or type your own..."
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              className="sm:w-48"
            />
            <Button onClick={handleAddLanguage} size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Start assessment
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAddLanguage(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assessment dialog */}
      {showAssessment && selectedLanguage && (
        <AssessmentDialog
          open={showAssessment}
          language={selectedLanguage}
          onClose={() => setShowAssessment(false)}
          onComplete={handleAssessmentComplete}
        />
      )}

      {/* Stats (always visible) */}
      <LanguageStats sessions={sessions} />

      {/* Spaced-repetition: lessons due for review right now */}
      {!selectedModule && dueReviews.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4" />
              Due for review ({dueReviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueReviews.map(({ lesson, mastery }) => (
              <button
                key={lesson.id}
                onClick={() => setSelectedModule(lesson)}
                className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left text-sm hover:bg-accent/5"
              >
                <span className="font-medium">{lesson.title}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(mastery.mastery)}% · was due {formatDateUK(mastery.next_review_at.slice(0, 10))}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Module section or module detail */}
      {selectedLanguage && (
        <>
          {selectedModule ? (
            <ModuleDetail
              module={selectedModule}
              onBack={() => setSelectedModule(null)}
              onModuleCompleted={handleModuleCompleted}
              onReviewed={() => selectedLanguage && fetchModules(selectedLanguage)}
            />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5" />
                  {selectedLanguage} Curriculum
                </CardTitle>
                {assessments.find((a) => a.language === selectedLanguage) && (
                  <span className="text-xs text-muted-foreground">
                    {modules.filter((m) => m.completed).length} / {modules.length} completed
                  </span>
                )}
              </CardHeader>
              <CardContent>
                <LanguageLearningPath
                  units={units}
                  groups={lessonGroups}
                  modules={modules}
                  onSelect={setSelectedModule}
                  generating={generating}
                  onGenerate={() => generateModulesFor(selectedLanguage)}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Manual session logging (collapsible) */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardTitle className="text-lg">Log a session manually</CardTitle>
            {showLogForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CardHeader>
        {showLogForm && (
          <CardContent>
            <LanguageForm onSaved={fetchAll} />
          </CardContent>
        )}
      </Card>

      {/* History */}
      <LanguageHistory sessions={sessions} />
    </div>
  );
}
