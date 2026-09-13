'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Compass, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActivityTimerWidget } from '@/components/activity-timer-widget';
import { ScheduleAlertBanner } from '@/components/schedule-alert-banner';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { NAV_ITEMS, ALWAYS_VISIBLE_HREFS } from '@/lib/nav-items';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function AppShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
}) {
  const { signOut } = useAuth();
  const { settings } = useUserSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const hidden = new Set(settings?.hidden_modules ?? []);
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => ALWAYS_VISIBLE_HREFS.includes(item.href) || !hidden.has(item.href)
  );

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // localStorage unavailable — keep default expanded
    }
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="relative min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'glass-panel fixed left-0 top-0 z-40 hidden h-screen flex-col lg:flex',
          hydrated && 'transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-[4.5rem]' : 'w-60'
        )}
      >
        <div className={cn('flex items-center gap-3 border-b border-white/10 px-4 py-5', collapsed && 'justify-center px-0')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold leading-tight">Dedication</span>
              <span className="truncate text-xs text-muted-foreground leading-tight">Optimiser</span>
            </div>
          )}
        </div>

        {!collapsed && <ActivityTimerWidget />}

        <nav className="flex-1 space-y-1 px-3 py-2">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === '/app'
                ? currentPath === '/app'
                : currentPath.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'border-foreground bg-white/[0.06] font-semibold text-foreground'
                    : 'border-transparent font-medium text-muted-foreground hover:border-white/20 hover:bg-white/[0.04] hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Button
            variant="ghost"
            size="sm"
            title={collapsed ? 'Collapse sidebar' : undefined}
            className={cn('w-full text-muted-foreground hover:text-foreground', collapsed ? 'justify-center px-0' : 'justify-start')}
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="mr-2 h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title={collapsed ? 'Sign out' : undefined}
            className={cn('w-full text-muted-foreground hover:text-foreground', collapsed ? 'justify-center px-0' : 'justify-start')}
            onClick={signOut}
          >
            <LogOut className={cn('h-4 w-4', !collapsed && 'mr-2')} />
            {!collapsed && 'Sign out'}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass-panel sticky top-0 z-40 flex items-center justify-between px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Compass className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">Dedication Optimiser</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </Button>
      </header>

      {mobileOpen && (
        <div className="glass-panel absolute left-0 right-0 z-30 border-t-0 px-4 py-3 lg:hidden">
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const isActive =
                item.href === '/app'
                  ? currentPath === '/app'
                  : currentPath.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'border-foreground bg-white/[0.06] font-semibold text-foreground'
                      : 'border-transparent font-medium text-muted-foreground hover:border-white/20 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className={cn(hydrated && 'transition-[padding] duration-200 ease-in-out', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-60')}>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <ScheduleAlertBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
