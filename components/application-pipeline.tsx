'use client';

import { useState } from 'react';
import { supabase, type JobApplication, type JobApplicationStatus } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApplicationForm } from '@/components/application-form';
import { workingDaysBetween, formatDateUK } from '@/lib/utils/dates';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/types/applications';
import {
  MoreVertical,
  Pencil,
  Trash2,
  Bell,
  ExternalLink,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTIVE_STATUSES: JobApplicationStatus[] = [
  'researching',
  'applied',
  'phone_screen',
  'interview',
  'offer',
];

const STATUS_BADGE_VARIANT: Record<
  JobApplicationStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  researching: 'secondary',
  applied: 'default',
  phone_screen: 'secondary',
  interview: 'default',
  offer: 'success',
  rejected: 'destructive',
  withdrawn: 'outline',
};

type ApplicationPipelineProps = {
  applications: JobApplication[];
  onChanged: () => void;
};

export function ApplicationPipeline({ applications, onChanged }: ApplicationPipelineProps) {
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const active = applications.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const inactive = applications.filter((a) => !ACTIVE_STATUSES.includes(a.status));

  async function handleStatusChange(app: JobApplication, newStatus: JobApplicationStatus) {
    const { error } = await supabase
      .from('job_applications')
      .update({ status: newStatus })
      .eq('id', app.id);
    if (error) return;
    onChanged();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('job_applications').delete().eq('id', id);
    if (error) return;
    onChanged();
  }

  async function handleFollowUpToggle(app: JobApplication) {
    const { error } = await supabase
      .from('job_applications')
      .update({ follow_up_sent: !app.follow_up_sent })
      .eq('id', app.id);
    if (error) return;
    onChanged();
  }

  function handleEdit(app: JobApplication) {
    setEditing(app);
    setEditOpen(true);
  }

  return (
    <div className="space-y-6">
      {active.length === 0 && inactive.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No applications yet. Add your first one to start tracking.
            </p>
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active pipeline
          </h2>
          <div className="space-y-3">
            {active.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onFollowUpToggle={handleFollowUpToggle}
              />
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Closed
          </h2>
          <div className="space-y-2">
            {inactive.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onFollowUpToggle={handleFollowUpToggle}
                compact
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit application</DialogTitle>
          </DialogHeader>
          <ApplicationForm
            editing={editing}
            onSaved={() => {
              setEditOpen(false);
              onChanged();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationCard({
  app,
  onStatusChange,
  onDelete,
  onEdit,
  onFollowUpToggle,
  compact,
}: {
  app: JobApplication;
  onStatusChange: (app: JobApplication, status: JobApplicationStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (app: JobApplication) => void;
  onFollowUpToggle: (app: JobApplication) => void;
  compact?: boolean;
}) {
  const followUpInfo = computeFollowUp(app);

  return (
    <Card className={cn(followUpInfo.needsFollowUp && !app.follow_up_sent && !compact && 'border-warning/50')}>
      <CardContent className={cn('p-4', compact && 'py-3')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{app.company}</span>
              <Badge variant={STATUS_BADGE_VARIANT[app.status]} className="text-xs">
                {STATUS_LABELS[app.status]}
              </Badge>
              {followUpInfo.needsFollowUp && !app.follow_up_sent && !compact && (
                <Badge variant="warning" className="text-xs">
                  <Bell className="mr-1 h-3 w-3" />
                  Follow up — {followUpInfo.workingDays}d
                </Badge>
              )}
              {app.follow_up_sent && (
                <Badge variant="outline" className="text-xs text-success">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Followed up
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{app.role}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {app.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {app.location}
                </span>
              )}
              {app.applied_date && (
                <span>Applied {formatDateUK(app.applied_date)}</span>
              )}
              {app.url && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Link
                </a>
              )}
            </div>
            {app.note && !compact && (
              <p className="pt-1 text-xs text-muted-foreground">{app.note}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!compact && (
              <Select
                value={app.status}
                onValueChange={(v) => onStatusChange(app, v as JobApplicationStatus)}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!compact && followUpInfo.needsFollowUp && !app.follow_up_sent && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-warning text-warning hover:bg-warning/10"
                onClick={() => onFollowUpToggle(app)}
              >
                <Bell className="mr-1 h-3 w-3" />
                Sent
              </Button>
            )}

            {!compact && app.follow_up_sent && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => onFollowUpToggle(app)}
              >
                Undo follow-up
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(app)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(app.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function computeFollowUp(app: JobApplication): {
  needsFollowUp: boolean;
  workingDays: number;
} {
  if (!app.applied_date) return { needsFollowUp: false, workingDays: 0 };
  if (app.status !== 'applied') return { needsFollowUp: false, workingDays: 0 };

  const applied = new Date(app.applied_date + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const workingDays = workingDaysBetween(applied, now);
  return {
    needsFollowUp: workingDays >= 5,
    workingDays,
  };
}
