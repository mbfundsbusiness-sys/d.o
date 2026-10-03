import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';

export function StatCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <GlassCard hoverLift={false} className={cn('p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {delta && <p className="mt-1 text-xs text-muted-foreground">{delta}</p>}
    </GlassCard>
  );
}
