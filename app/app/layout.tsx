'use client';

import { useAuth } from '@/lib/auth/provider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { TimerProvider } from '@/lib/timer/context';
import { ScheduleAlertsProvider } from '@/lib/notifications/schedule-alerts';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [session, loading, router]);

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
