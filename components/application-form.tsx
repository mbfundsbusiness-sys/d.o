'use client';

import { useState, FormEvent } from 'react';
import { supabase, type JobApplication, type JobApplicationInsert, type JobApplicationStatus } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { todayISO } from '@/lib/utils/dates';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/types/applications';

type ApplicationFormProps = {
  onSaved: () => void;
  editing?: JobApplication | null;
};

export function ApplicationForm({ onSaved, editing }: ApplicationFormProps) {
  const [company, setCompany] = useState(editing?.company ?? '');
  const [role, setRole] = useState(editing?.role ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [status, setStatus] = useState<JobApplicationStatus>(editing?.status ?? 'researching');
  const [appliedDate, setAppliedDate] = useState(editing?.applied_date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editing) {
        const { error } = await supabase
          .from('job_applications')
          .update({
            company,
            role,
            location: location || null,
            url: url || null,
            status,
            applied_date: appliedDate || null,
            note: note || null,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const entry: JobApplicationInsert = {
          company,
          role,
          location: location || null,
          url: url || null,
          status,
          applied_date: appliedDate || null,
          note: note || null,
        };
        const { error } = await supabase.from('job_applications').insert(entry);
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">Company *</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            placeholder="e.g. Revolut"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role *</Label>
          <Input
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            placeholder="e.g. Junior Software Engineer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. London / Reading"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">Link</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as JobApplicationStatus)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="applied-date">Date applied</Label>
          <Input
            id="applied-date"
            type="date"
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Contact name, recruiter details, interview notes..."
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {editing ? 'Save changes' : 'Add application'}
      </Button>
    </form>
  );
}
