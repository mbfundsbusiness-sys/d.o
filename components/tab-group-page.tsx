'use client';

import { Suspense, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export type GroupTab = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; View: ComponentType };

function Inner({ tabs }: { tabs: GroupTab[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = tabs.find((t) => t.id === params.get('tab')) ?? tabs[0];
  const View = active.View;

  return (
    <div className="space-y-6">
      <div className="flex w-fit max-w-full items-center overflow-x-auto rounded-lg border border-border p-0.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={`${pathname}?tab=${t.id}`}
              replace
              scroll={false}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                t.id === active.id ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <View key={active.id} />
    </div>
  );
}

export function TabGroupPage({ tabs }: { tabs: GroupTab[] }) {
  return (
    <Suspense fallback={null}>
      <Inner tabs={tabs} />
    </Suspense>
  );
}
