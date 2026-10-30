'use client';

import ReactMarkdown from 'react-markdown';
import type { UIMessage } from 'ai';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOOL_LABELS: Record<string, string> = {
  get_day: 'Checked the day',
  replan_day: 'Re-planned the day',
  add_block: 'Added to the plan',
  move_block: 'Moved a block',
  mark_block: 'Updated a block',
  drop_block: 'Dropped a block',
  add_todo: 'Added a to-do',
  update_todo: 'Updated a to-do',
  list_todos: 'Checked to-dos',
  delete_todo: 'Deleted a to-do',
  add_shift: 'Added a shift',
  log_shift: 'Logged a shift',
  update_shift: 'Changed a shift',
  delete_shift: 'Deleted a shift',
  add_bill: 'Added a bill',
  update_bill: 'Updated a bill',
  add_pot: 'Created a pot',
  update_pot: 'Updated a pot',
  add_pot_item: 'Added to a pot',
  update_pot_item: 'Updated a pot item',
  set_pay: 'Updated pay settings',
  set_rule: 'Changed a rule',
  get_language_module: 'Opened a language module',
  list_language_modules: 'Checked language modules',
  complete_language_module: 'Marked a module done',
  add_language_module: 'Wrote a new language module',
};

type ToolPart = { type: string; state?: string; input?: unknown; output?: unknown; errorText?: string };

function ToolChip({ part }: { part: ToolPart }) {
  const name = part.type.slice('tool-'.length);
  const label = TOOL_LABELS[name] ?? name;
  const out = part.output as { error?: string } | undefined;
  const failed = part.state === 'output-error' || (out && typeof out === 'object' && 'error' in out);
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const detail = describeInput(name, part.input);
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
        failed ? 'border-red-500/40 text-red-300' : 'border-border text-muted-foreground'
      )}
      title={failed ? (part.errorText ?? out?.error) : undefined}
    >
      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : failed ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3 text-emerald-400" />}
      <span className="truncate">
        {label}
        {detail ? `: ${detail}` : ''}
        {failed && out?.error ? ` (${out.error})` : ''}
      </span>
    </div>
  );
}

function describeInput(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const i = input as Record<string, unknown>;
  if (name === 'set_rule') return `${i.path} = ${JSON.stringify(i.value)}`;
  if (typeof i.title === 'string') return i.title;
  if (typeof i.name === 'string') return i.name;
  if (name === 'log_shift' && typeof i.drops === 'number') return `${i.drops} drops`;
  if (typeof i.date === 'string') return i.date;
  return '';
}

export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[85%] flex-col gap-2', isUser && 'items-end')}>
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            if (!part.text.trim()) return null;
            return isUser ? (
              <div key={i} className="whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
                {part.text}
              </div>
            ) : (
              <div key={i} className="prose-chat text-[15px] leading-relaxed">
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            );
          }
          if (part.type.startsWith('tool-')) return <ToolChip key={i} part={part as ToolPart} />;
          return null;
        })}
      </div>
    </div>
  );
}
