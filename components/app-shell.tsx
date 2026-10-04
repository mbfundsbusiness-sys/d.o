'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SlideOver } from '@/components/ui/slide-over';
import { AssistantPanel } from '@/components/assistant-panel';
import {
  Compass,
  LogOut,
  MoreHorizontal,
  Bell,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RunningTimerFallback } from '@/components/running-timer-fallback';
import { ScheduleAlertBanner } from '@/components/schedule-alert-banner';
import { useScheduleAlerts } from '@/lib/notifications/schedule-alerts';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { NAV_ITEMS, ALWAYS_VISIBLE_HREFS, MOBILE_PRIMARY_HREFS } from '@/lib/nav-items';
import { londonNow } from '@/lib/utils/dates';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const RAIL_EXPANDED_KEY = 'rail-expanded';

export function AppShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
}) {
  const { signOut, user } = useAuth();
  const { settings } = useUserSettings();
  const { banners } = useScheduleAlerts();
  const [moreOpen, setMoreOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setExpanded(localStorage.getItem(RAIL_EXPANDED_KEY) === '1');
    } catch {
      // localStorage unavailable — keep default collapsed
    }
    setHydrated(true);
  }, []);

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_EXPANDED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  const hidden = new Set(settings?.hidden_modules ?? []);
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => ALWAYS_VISIBLE_HREFS.includes(item.href) || !hidden.has(item.href)
  );

  const isActive = (href: string) => (href === '/app' ? currentPath === '/app' : currentPath.startsWith(href));

  const primaryItems = useMemo(
    () => MOBILE_PRIMARY_HREFS.map((href) => visibleNavItems.find((i) => i.href === href)).filter((i): i is NonNullable<typeof i> => !!i),
    [visibleNavItems]
  );
  const moreItems = visibleNavItems.filter((i) => !MOBILE_PRIMARY_HREFS.includes(i.href));

  const hour = mounted ? londonNow().hour : 9;
  const firstName = (user?.email ?? 'there').split('@')[0];

  return (
    <div className="relative min-h-screen">
      {/* Desktop icon rail — collapsed (icons only, hover tooltips) or expanded (icons + labels) */}
      <aside
        className={cn(
          'glass-panel fixed left-0 top-0 z-40 hidden h-screen flex-col py-4 lg:flex',
          hydrated && 'transition-[width] duration-200 ease-in-out',
          expanded ? 'w-56 items-stretch px-3' : 'w-16 items-center'
        )}
      >
        <Link
          href="/app"
          className={cn('mb-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary', expanded && 'ml-0')}
          aria-label="Dashboard"
        >
          <Compass className="h-5 w-5 text-primary-foreground" />
        </Link>

        <nav className={cn('flex flex-1 flex-col gap-1 overflow-y-auto py-1', !expanded && 'items-center')} aria-label="Main">
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={expanded ? undefined : item.label}
                className={cn(
                  'group relative flex h-10 shrink-0 items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  expanded ? 'w-full gap-3 px-3' : 'w-10 justify-center',
                  active ? 'bg-white/[0.1] text-foreground' : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {expanded && <span className="truncate text-sm font-medium">{item.label}</span>}
                {active && (
                  <span
                    className={cn(
                      'absolute h-5 w-0.5 rounded-full bg-foreground',
                      expanded ? 'left-0' : 'left-0 -translate-x-[calc(100%+2px)]'
                    )}
                  />
                )}
                {!expanded && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          title={expanded ? undefined : 'Expand sidebar'}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className={cn('mb-1 text-muted-foreground hover:text-foreground', expanded ? 'w-full justify-start' : 'justify-center px-0')}
          onClick={toggleExpanded}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {expanded && <span className="ml-2">Collapse</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title={expanded ? undefined : 'Sign out'}
          aria-label="Sign out"
          onClick={signOut}
          className={cn('text-muted-foreground hover:text-foreground', expanded ? 'w-full justify-start' : 'justify-center px-0')}
        >
          <LogOut className="h-4 w-4" />
          {expanded && <span className="ml-2">Sign out</span>}
        </Button>
      </aside>

      {/* Main content */}
      <div className={cn(hydrated && 'transition-[padding] duration-200 ease-in-out', expanded ? 'lg:pl-56' : 'lg:pl-16')}>
        {/* Header */}
        <header className="glass-panel sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Compass className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight sm:text-base">
              {greeting(hour)}, {firstName}
            </p>
            <p className="truncate text-xs text-muted-foreground leading-tight">
              Phase 1 — Foundation. Keep the daily anchors locked in.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">
              {mounted ? new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' }) : ''}
            </span>
            <Button variant="ghost" size="icon" aria-label={`Notifications${banners.length > 0 ? ` (${banners.length})` : ''}`} className="relative">
              <Bell className="h-4 w-4" />
              {banners.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-foreground" />
              )}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Toggle AI assistant" onClick={() => setAssistantOpen(true)}>
              <Sparkles className="h-4 w-4" />
            </Button>
            <Link
              href="/app/settings"
              aria-label="Settings and account"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground"
            >
              {firstName.slice(0, 2)}
            </Link>
          </div>
        </header>

        <main className="pb-20 lg:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <ScheduleAlertBanner />
            <RunningTimerFallback />
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="glass-panel fixed inset-x-0 bottom-0 z-40 flex items-center justify-around px-2 py-1.5 lg:hidden"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
        aria-label="Primary"
      >
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label.split(' ')[0]}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-muted-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/70" onClick={() => setMoreOpen(false)} aria-hidden />
          <div
            className="glass-panel absolute inset-x-2 bottom-2 rounded-2xl p-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">More</span>
              <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setMoreOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-xs font-medium text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  signOut();
                }}
                className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-xs font-medium text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <SlideOver open={assistantOpen} onClose={() => setAssistantOpen(false)} title="AI Assistant">
        <AssistantPanel />
      </SlideOver>
    </div>
  );
}
