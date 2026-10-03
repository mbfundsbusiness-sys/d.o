'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export function GlassCard({
  className,
  children,
  hoverLift = true,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hoverLift?: boolean }) {
  return (
    <motion.div
      className={cn('glass-surface rounded-2xl p-5', className)}
      whileHover={hoverLift ? { y: -4 } : undefined}
      transition={{ duration: 0.15 }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  );
}

export function DashCard({
  title,
  icon: Icon,
  href,
  loading,
  error,
  empty,
  className,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <GlassCard className={cn('flex flex-col', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            View <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex-1">
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label={`Loading ${title}`}>
            <div className="h-3 w-3/4 animate-pulse rounded bg-foreground/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-foreground/10" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-foreground/10" />
          </div>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : empty ? (
          <p className="text-xs text-muted-foreground">Nothing here yet.</p>
        ) : (
          children
        )}
      </div>
    </GlassCard>
  );
}
