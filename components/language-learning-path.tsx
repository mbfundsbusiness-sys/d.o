'use client';

import type { LangUnit, LangLessonGroup, LanguageModule } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Lock, Sparkles } from 'lucide-react';
import { FOCUS_ICONS, FOCUS_LABELS } from '@/components/language-module-list';
import { cn } from '@/lib/utils';

type LanguageLearningPathProps = {
  units: LangUnit[];
  groups: LangLessonGroup[];
  modules: LanguageModule[];
  onSelect: (module: LanguageModule) => void;
  selectedId?: string;
  generating?: boolean;
  onGenerate?: () => void;
};

function allCompleted(lessons: LanguageModule[]): boolean {
  return lessons.length > 0 && lessons.every((l) => l.completed);
}

export function LanguageLearningPath({
  units,
  groups,
  modules,
  onSelect,
  selectedId,
  generating,
  onGenerate,
}: LanguageLearningPathProps) {
  if (generating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm">Generating your learning path...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (units.length === 0 || modules.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="mb-3 text-sm text-muted-foreground">No learning path yet.</p>
          {onGenerate && (
            <Button size="sm" onClick={onGenerate}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate curriculum
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const sortedUnits = [...units].sort((a, b) => a.unit_number - b.unit_number);
  const lessonsByGroup = (groupId: string) =>
    modules.filter((m) => m.lesson_group_id === groupId).sort((a, b) => a.module_number - b.module_number);
  const groupsByUnit = (unitId: string) =>
    groups.filter((g) => g.unit_id === unitId).sort((a, b) => a.group_number - b.group_number);
  const lessonsInUnit = (unitId: string) =>
    groupsByUnit(unitId).flatMap((g) => lessonsByGroup(g.id));

  let previousUnitComplete = true; // unit 1 always unlocked

  return (
    <div className="space-y-4">
      {sortedUnits.map((unit) => {
        const unitLessons = lessonsInUnit(unit.id);
        const unitUnlocked = previousUnitComplete;
        const unitDone = allCompleted(unitLessons);
        previousUnitComplete = unitDone;

        const unitProgress = unitLessons.length
          ? Math.round((unitLessons.filter((l) => l.completed).length / unitLessons.length) * 100)
          : 0;

        let previousGroupComplete = true;

        return (
          <Card key={unit.id} className={cn(!unitUnlocked && 'opacity-50')}>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Unit {unit.unit_number}
                  </p>
                  <h3 className="text-base font-semibold">{unit.title}</h3>
                </div>
                {!unitUnlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                {unitUnlocked && unitLessons.length > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">{unitProgress}%</span>
                )}
              </div>

              {unitUnlocked &&
                groupsByUnit(unit.id).map((group) => {
                  const lessons = lessonsByGroup(group.id);
                  const groupUnlocked = previousGroupComplete;
                  const groupDone = allCompleted(lessons);
                  previousGroupComplete = groupDone;

                  return (
                    <div key={group.id} className={cn('space-y-2', !groupUnlocked && 'opacity-50')}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{group.title}</p>
                        {!groupUnlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lessons.map((lesson, i) => {
                          const isLocked = !groupUnlocked || (i > 0 && !lessons[i - 1].completed);
                          const isSelected = selectedId === lesson.id;
                          const Icon = FOCUS_ICONS[lesson.focus_area];

                          return (
                            <button
                              key={lesson.id}
                              onClick={() => !isLocked && onSelect(lesson)}
                              disabled={isLocked}
                              title={`${lesson.title} — ${FOCUS_LABELS[lesson.focus_area]}`}
                              className={cn(
                                'flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full border-2 text-[10px] transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary/10'
                                  : isLocked
                                  ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                                  : lesson.completed
                                  ? 'border-success/40 bg-success/10 text-success'
                                  : 'border-border hover:border-primary/40 hover:bg-accent/5'
                              )}
                            >
                              {lesson.completed ? (
                                <Check className="h-4 w-4" />
                              ) : isLocked ? (
                                <Lock className="h-3.5 w-3.5" />
                              ) : (
                                <Icon className="h-4 w-4" />
                              )}
                              <span className="leading-none">{lesson.module_number}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
