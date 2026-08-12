'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type LanguageSession, type LanguageAssessment, type LanguageModule } from '@/lib/supabase/client';
import { LanguageStats } from '@/components/language-stats';
import { LanguageHistory } from '@/components/language-history';
import { LanguageForm } from '@/components/language-session-form';
import { AssessmentDialog } from '@/components/language-assessment-dialog';
import { ModuleList } from '@/components/language-module-list';
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
import { Loader2, Plus, Sparkles, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const COMMON_LANGUAGES = ['Spanish', 'French', 'German', 'Arabic', 'Japanese', 'Mandarin', 'Italian', 'Portuguese'];

export default function LanguagePage() {
  const [sessions, setSessions] = useState<LanguageSession[]>([]);
  const [assessments, setAssessments] = useState<LanguageAssessment[]>([]);
  const [modules, setModules] = useState<LanguageModule[]>([]);
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
    const { data, error } = await supabase
      .from('language_modules')
      .select('*')
      .eq('language', language)
      .order('module_number', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setModules(data ?? []);
    }
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
    }
  }, [selectedLanguage, fetchModules]);

  // Auto-select first assessed language
  useEffect(() => {
    if (!selectedLanguage && assessments.length > 0) {
      setSelectedLanguage(assessments[0].language);
    }
  }, [assessments, selectedLanguage]);

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

  async function handleAssessmentComplete(_assessment: LanguageAssessment) {
    setShowAssessment(false);
    setGenerating(true);

    // Refresh assessments
    const { data: newAssessments } = await supabase
      .from('language_assessments')
      .select('*')
      .order('created_at', { ascending: false });
    setAssessments(newAssessments ?? []);

    // Generate modules
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
        body: JSON.stringify({ language: _assessment.language, count: 4 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate modules');

      await fetchModules(_assessment.language);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate curriculum');
    } finally {
      setGenerating(false);
    }
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
          <Button
            key={a.id}
            variant={selectedLanguage === a.language ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedLanguage(a.language)}
          >
            {a.language}
          </Button>
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

      {/* Module section or module detail */}
      {selectedLanguage && (
        <>
          {selectedModule ? (
            <ModuleDetail
              module={selectedModule}
              onBack={() => setSelectedModule(null)}
              onModuleCompleted={handleModuleCompleted}
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
                <ModuleList
                  modules={modules}
                  onSelect={setSelectedModule}
                  selectedId={undefined}
                  generating={generating}
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
