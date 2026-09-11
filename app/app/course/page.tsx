'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type CourseModule, type CourseProfile } from '@/lib/supabase/client';
import { CourseModuleList } from '@/components/course-module-list';
import { CourseModuleDetail } from '@/components/course-module-detail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Sparkles, ShieldCheck } from 'lucide-react';

const SUGGESTED_COURSES = ['Cybersecurity'];

export default function CoursePage() {
  const [profiles, setProfiles] = useState<CourseProfile[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('Cybersecurity');
  const [syllabus, setSyllabus] = useState('');
  const [goal, setGoal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('course_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setProfiles(data ?? []);
    setLoading(false);
  }, []);

  const fetchModules = useCallback(async (courseName: string) => {
    const { data, error } = await supabase
      .from('course_modules')
      .select('*')
      .eq('course_name', courseName)
      .order('module_number', { ascending: true });
    if (error) setError(error.message);
    else setModules(data ?? []);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (selectedCourse) {
      fetchModules(selectedCourse);
      setSelectedModule(null);
    } else {
      setModules([]);
    }
  }, [selectedCourse, fetchModules]);

  useEffect(() => {
    if (!selectedCourse && profiles.length > 0) {
      setSelectedCourse(profiles[0].course_name);
    }
  }, [profiles, selectedCourse]);

  async function generateModulesFor(courseName: string) {
    setGenerating(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No session');

      const res = await fetch('/api/course/generate-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ courseName, count: 4 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate modules');

      await fetchModules(courseName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate modules');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddCourse() {
    const name = newCourseName.trim();
    if (!name) return;

    setSavingProfile(true);
    setError(null);
    try {
      const existing = profiles.find((p) => p.course_name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        const { error: upsertError } = await supabase
          .from('course_profiles')
          .upsert(
            { course_name: name, syllabus: syllabus.trim() || null, goal: goal.trim() || null },
            { onConflict: 'user_id,course_name' }
          );
        if (upsertError) throw new Error(upsertError.message);
        await fetchProfiles();
      }
      setSelectedCourse(name);
      setShowAddCourse(false);
      setSyllabus('');
      setGoal('');
      await generateModulesFor(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleModuleCompleted() {
    if (selectedCourse) await fetchModules(selectedCourse);
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Course</h1>
        <p className="text-sm text-muted-foreground">
          AI study companion for a course you're already enrolled in — paste your syllabus and it
          breaks it into modules, with a tutor chat to work through each one.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {profiles.map((p) => (
          <Button
            key={p.id}
            variant={selectedCourse === p.course_name ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCourse(p.course_name)}
          >
            {p.course_name}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setShowAddCourse((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          Add course
        </Button>
      </div>

      {showAddCourse && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="course-name" className="text-xs">Course name</Label>
                <Input
                  id="course-name"
                  list="suggested-courses"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="e.g. Cybersecurity"
                />
                <datalist id="suggested-courses">
                  {SUGGESTED_COURSES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label htmlFor="course-goal" className="text-xs">Goal (optional)</Label>
                <Input
                  id="course-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. pass the certification exam"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="course-syllabus" className="text-xs">
                Syllabus / topics (optional, but the more you paste the better the modules track your actual course)
              </Label>
              <Textarea
                id="course-syllabus"
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
                placeholder="Paste your course outline, module list, or topics here..."
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddCourse} size="sm" disabled={savingProfile || !newCourseName.trim()}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate modules
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddCourse(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCourse && (
        selectedModule ? (
          <CourseModuleDetail
            module={selectedModule}
            onBack={() => setSelectedModule(null)}
            onModuleCompleted={handleModuleCompleted}
          />
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5" />
                {selectedCourse}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {modules.filter((m) => m.completed).length} / {modules.length} completed
              </span>
            </CardHeader>
            <CardContent>
              <CourseModuleList
                modules={modules}
                onSelect={setSelectedModule}
                generating={generating}
                onGenerate={() => generateModulesFor(selectedCourse)}
              />
            </CardContent>
          </Card>
        )
      )}

      {!selectedCourse && profiles.length === 0 && !showAddCourse && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Add a course — cybersecurity or anything else — and paste in your syllabus to get
              started.
            </p>
            <Button onClick={() => setShowAddCourse(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add course
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
