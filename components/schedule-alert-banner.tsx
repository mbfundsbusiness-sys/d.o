'use client';

import { useScheduleAlerts } from '@/lib/notifications/schedule-alerts';
import { Bell, X } from 'lucide-react';

export function ScheduleAlertBanner() {
  const { banners, dismiss } = useScheduleAlerts();

  if (banners.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {banners.map((b) => (
        <div
          key={b.id}
          className="flex items-start gap-3 rounded-lg border-2 border-foreground bg-white/[0.06] px-4 py-3"
          role="status"
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{b.title}</p>
            <p className="text-xs text-muted-foreground">{b.body}</p>
          </div>
          <button
            onClick={() => dismiss(b.id)}
            className="text-muted-foreground hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
