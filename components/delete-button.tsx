'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A small, consistent delete affordance reused across every module's list/
 * history views. Confirms, calls the passed delete action, then lets the
 * caller refetch. Stops propagation so it's safe to place inside a larger
 * clickable row without also triggering that row's own onClick.
 */
export function DeleteButton({
  onDelete,
  confirmText = 'Delete this? This cannot be undone.',
  className,
  size = 'sm',
}: {
  onDelete: () => Promise<void>;
  confirmText?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Delete"
      aria-label="Delete"
      className={cn(
        'shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50',
        className
      )}
    >
      {busy ? (
        <Loader2 className={cn('animate-spin', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      ) : (
        <Trash2 className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      )}
    </button>
  );
}
