'use client';

import type { LanguageModule, ModuleFocusArea } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Lock, BookOpen, MessageSquare, Headphones, Mic, BookText, Type, Sparkles } from 'lucide-react';

const FOCUS_ICONS: Record<ModuleFocusArea, typeof BookOpen> = {
  vocabulary: Type,
  grammar: BookOpen,
  listening: Headphones,
  speaking: Mic,
  reading: BookText,
};

const FOCUS_LABELS: Record<ModuleFocusArea, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
};

type ModuleListProps = {
  modules: LanguageModule[];
  onSelect: (module: LanguageModule) => void;
  selectedId?: string;
  generating?: boolean;
  onGenerate?: () => void;
};

export function ModuleList({ modules, onSelect, selectedId, generating, onGenerate }: ModuleListProps) {
  if (generating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm">Generating your curriculum...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (modules.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="mb-3 text-sm text-muted-foreground">
            No modules yet.
          </p>
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

  return (
    <div className="space-y-2">
      {modules.map((m, i) => {
        const Icon = FOCUS_ICONS[m.focus_area];
        const isLocked = i > 0 && !modules[i - 1].completed;
        const isSelected = selectedId === m.id;

        return (
          <button
            key={m.id}
            onClick={() => !isLocked && onSelect(m)}
            disabled={isLocked}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              isSelected
                ? 'border-primary bg-primary/5'
                : isLocked
                ? 'border-border opacity-50 cursor-not-allowed'
                : 'border-border hover:bg-accent/5'
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              m.completed
                ? 'bg-success/10 text-success'
                : isLocked
                ? 'bg-muted text-muted-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}>
              {m.completed ? (
                <Check className="h-5 w-5" />
              ) : isLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Module {m.module_number}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {FOCUS_LABELS[m.focus_area]}
                </Badge>
              </div>
              <p className="text-sm font-medium truncate">{m.title}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { FOCUS_ICONS, FOCUS_LABELS };
