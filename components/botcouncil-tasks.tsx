'use client';

import { useState } from 'react';
import { supabase, type BotCouncilTask } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type BotCouncilTasksProps = {
  tasks: BotCouncilTask[];
  onChanged: () => void;
};

export function BotCouncilTasks({ tasks, onChanged }: BotCouncilTasksProps) {
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || adding) return;

    setAdding(true);
    const { error } = await supabase.from('botcouncil_tasks').insert({ title: trimmed });
    setAdding(false);
    if (!error) {
      setTitle('');
      onChanged();
    }
  }

  async function handleToggle(task: BotCouncilTask) {
    setBusyId(task.id);
    const newCompleted = !task.completed;
    await supabase
      .from('botcouncil_tasks')
      .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
      .eq('id', task.id);
    setBusyId(null);
    onChanged();
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    await supabase.from('botcouncil_tasks').delete().eq('id', id);
    setBusyId(null);
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Maintenance tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="e.g. Rotate API keys, check error logs..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit" disabled={!title.trim() || adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No maintenance tasks yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {[...open, ...done].map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <button
                  onClick={() => handleToggle(task)}
                  disabled={busyId === task.id}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                    task.completed ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground'
                  )}
                >
                  {task.completed && <Check className="h-3.5 w-3.5" />}
                </button>
                <span className={cn('flex-1 text-sm', task.completed && 'text-muted-foreground line-through')}>
                  {task.title}
                </span>
                <button
                  onClick={() => handleDelete(task.id)}
                  disabled={busyId === task.id}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
