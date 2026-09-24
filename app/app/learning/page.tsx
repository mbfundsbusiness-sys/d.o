'use client';

import { BookOpen, GraduationCap, Languages } from 'lucide-react';
import { TabGroupPage } from '@/components/tab-group-page';
import ReadingView from '@/components/views/reading-view';
import CoursesView from '@/components/views/courses-view';
import LanguageView from '@/components/views/language-view';

export default function LearningPage() {
  return (
    <TabGroupPage
      tabs={[
        { id: 'reading', label: 'Reading', icon: BookOpen, View: ReadingView },
        { id: 'courses', label: 'Courses', icon: GraduationCap, View: CoursesView },
        { id: 'language', label: 'Language', icon: Languages, View: LanguageView },
      ]}
    />
  );
}
