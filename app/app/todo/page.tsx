'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type TodoItem } from '@/lib/supabase/client';
import { TodoList } from '@/components/todo-list';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('todo_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
        <h1 className="text-2xl font-semibold tracking-tight">To-do</h1>
        <p className="text-sm text-muted-foreground">
          Short-term tasks that don't belong in the weekly Schedule. Give one a due time and it
          gets the same 15-minutes-before and on-time in-app alert as your schedule and prayers.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <TodoList items={items} onChanged={fetchItems} />
    </div>
  );
}
