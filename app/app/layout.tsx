'use client';

import { useAuth } from '@/lib/auth/provider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { TimerProvider } from '@/lib/timer/context';
import { ScheduleAlertsProvider } from '@/lib/notifications/schedule-alerts';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { applyBackdrop, isBackdropId, getStoredBackdrop } from '@/lib/backdrop';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useUserSettings();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [session, loading, router]);

  // Reconcile with the synced preference once it loads — the DB is the
  // source of truth across devices, localStorage is just what avoids a
  // flash on the very next page load.
  useEffect(() => {
    if (settings && isBackdropId(settings.backdrop) && settings.backdrop !== getStoredBackdrop()) {
      applyBackdrop(settings.backdrop);
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TimerProvider>
      <ScheduleAlertsProvider>
        <AppShell currentPath={pathname}>{children}</AppShell>
      </ScheduleAlertsProvider>
    </TimerProvider>
  );
}
