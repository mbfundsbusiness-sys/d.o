'use client';

import { useState, FormEvent } from 'react';
import { supabase, type LanguageActivityType } from '@/lib/supabase/client';
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

const ACTIVITY_TYPES: { value: LanguageActivityType; label: string }[] = [
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'listening', label: 'Listening' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'reading', label: 'Reading' },
];

const COMMON_LANGUAGES = ['Spanish', 'French', 'German', 'Arabic', 'Japanese', 'Mandarin', 'Italian', 'Portuguese'];

type LanguageFormProps = {
  onSaved: () => void;
};

export function LanguageForm({ onSaved }: LanguageFormProps) {
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [language, setLanguage] = useState('Spanish');
  const [customLanguage, setCustomLanguage] = useState('');
  const [activityType, setActivityType] = useState<LanguageActivityType>('vocabulary');
  const [durationMin, setDurationMin] = useState('30');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalLanguage = customLanguage.trim() || language;
    const mins = parseInt(durationMin, 10) || 0;
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from('language_sessions').insert({
      started_at: sessionDate + 'T00:00:00',
      ended_at: sessionDate + 'T00:00:00',
      duration_min: mins,
      language: finalLanguage,
      activity_type: activityType,
      note: note || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setCustomLanguage('');
    setNote('');
    setDurationMin('30');
    setLoading(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lang-date">Date</Label>
          <Input
            id="lang-date"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lang-duration">Duration (minutes)</Label>
          <Input
            id="lang-duration"
            type="number"
            min="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lang-select">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="lang-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lang-custom">Or type your own</Label>
          <Input
            id="lang-custom"
            placeholder="e.g. Korean, Turkish..."
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lang-activity">Activity type</Label>
        <Select value={activityType} onValueChange={(v) => setActivityType(v as LanguageActivityType)}>
          <SelectTrigger id="lang-activity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lang-note">Note (optional)</Label>
        <Textarea
          id="lang-note"
          placeholder="What did you cover? How did it feel?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Log session
      </Button>
    </form>
  );
}
