'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, GraduationCap, LogOut, Menu, PoundSterling, Sparkles, X } from 'lucide-react';
import { ASSISTANT_NAV } from '@/lib/assistants/nav';
import { useAuth } from '@/lib/auth/provider';
import { cn } from '@/lib/utils';

const ICONS = { ea: Sparkles, finance: PoundSterling, scholarship: GraduationCap, freelance: Briefcase } as const;

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { signOut, user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5 text-sm font-semibold tracking-tight">D.O.</div>
      <nav className="flex flex-col gap-0.5 px-2">
        {ASSISTANT_NAV.map((a) => {
          const Icon = ICONS[a.key];
          const href = a.key === 'ea' ? '/app' : `/app/${a.key}`;
          const active = path === href;
          return (
            <Link
              key={a.key}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex flex-col">
                <span className="flex items-center gap-2">
                  {a.name}
                  {!a.ready && <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">soon</span>}
                </span>
                <span className="text-xs text-muted-foreground">{a.blurb}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border p-3">
        <div className="truncate px-1 pb-2 text-xs text-muted-foreground">{user?.email}</div>
        <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-background/70 backdrop-blur-md md:block">
        <Nav />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-background">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <Nav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="absolute left-3 top-3.5 z-30 text-muted-foreground md:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
}
