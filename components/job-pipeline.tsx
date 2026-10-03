'use client';

import { useState } from 'react';
import { supabase, type JobApplication, type JobApplicationStatus } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeleteButton } from '@/components/delete-button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateUK } from '@/lib/utils/dates';
import { cn } from '@/lib/utils';

export const STATUS_LABELS: Record<JobApplicationStatus, string> = {
  researching: 'Researching',
  applied: 'Applied',
  phone_screen: 'Phone screen',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const STATUS_ORDER: JobApplicationStatus[] = [
  'researching', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn',
];

export function JobPipeline({ apps, onChanged }: { apps: JobApplication[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('job_applications').insert({
      company: company.trim(),
      role: role.trim(),
      location: location.trim() || null,
      url: url.trim() || null,
      status: 'researching',
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCompany('');
    setRole('');
    setLocation('');
    setUrl('');
    setShowForm(false);
    onChanged();
  }

  async function handleStatusChange(app: JobApplication, status: JobApplicationStatus) {
    const patch: Record<string, unknown> = { status };
    if (status === 'applied' && !app.applied_date) patch.applied_date = new Date().toISOString().slice(0, 10);
    await supabase.from('job_applications').update(patch).eq('id', app.id);
    onChanged();
  }

  async function handleToggleFollowUp(app: JobApplication) {
    await supabase.from('job_applications').update({ follow_up_sent: !app.follow_up_sent }).eq('id', app.id);
    onChanged();
  }

  async function handleDelete(id: string) {
    await supabase.from('job_applications').delete().eq('id', id);
    onChanged();
  }

  const sorted = [...apps].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <button onClick={() => setShowForm((v) => !v)} className="flex w-full items-center justify-between text-left">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4" /> Log a new application
            </span>
            {showForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showForm && (
            <form onSubmit={handleAdd} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Company</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location (optional)</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL (optional)</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add
                </Button>
              </div>
            </form>
          )}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No applications logged yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((app) => (
            <Card key={app.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{app.company}</p>
                    {app.url && (
                      <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {app.role}{app.location ? ` — ${app.location}` : ''}
                    {app.applied_date ? ` · applied ${formatDateUK(app.applied_date)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={app.status} onValueChange={(v) => handleStatusChange(app, v as JobApplicationStatus)}>
                    <SelectTrigger className="h-8 w-[9.5rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => handleToggleFollowUp(app)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      app.follow_up_sent ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Followed up
                  </button>
                  <DeleteButton onDelete={() => handleDelete(app.id)} confirmText="Delete this application?" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
