'use client';

import type { GymPlan } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Lock, Dumbbell, Moon } from 'lucide-react';

type GymWeekListProps = {
  plans: GymPlan[];
  onSelect: (plan: GymPlan) => void;
  generating?: boolean;
};

export function GymWeekList({ plans, onSelect, generating }: GymWeekListProps) {
  if (generating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm">Generating your training week...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Dumbbell className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No training plan yet. Complete the assessment to generate week 1.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {plans.map((p, i) => {
        const isLocked = i > 0 && !plans[i - 1].completed;

        return (
          <button
            key={p.id}
            onClick={() => !isLocked && onSelect(p)}
            disabled={isLocked}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              isLocked ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:bg-accent/5'
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              p.completed
                ? 'bg-success/10 text-success'
                : isLocked
                ? 'bg-muted text-muted-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}>
              {p.completed ? (
                <Check className="h-5 w-5" />
              ) : isLocked ? (
                <Lock className="h-4 w-4" />
              ) : p.is_deload ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Dumbbell className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Week {p.week_number}
                </span>
                {p.is_deload && (
                  <Badge variant="secondary" className="text-[10px]">Deload</Badge>
                )}
              </div>
              <p className="text-sm font-medium truncate">{p.title}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
