'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type CourseLog } from '@/lib/supabase/client';
import { CoursesList } from '@/components/courses-list';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setCourses(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
        <h1 className="text-2xl font-semibold tracking-tight">My Courses</h1>
        <p className="text-sm text-muted-foreground">
          Courses you're taking elsewhere — log them, track progress, time your sessions. Nothing
          here is AI-generated; you add and update these yourself. (Looking for an AI-guided
          curriculum instead? See Language or the Course module.)
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <CoursesList courses={courses} onChanged={fetchCourses} />
    </div>
  );
}
