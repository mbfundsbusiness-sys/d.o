'use client';

import { useState } from 'react';
import { supabase, type AnchorLogInsert } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, Plus } from 'lucide-react';
import { todayISO } from '@/lib/utils/dates';

type AnchorFormProps = {
  onLogged: () => void;
};

export function AnchorForm({ onLogged }: AnchorFormProps) {
  const [logDate, setLogDate] = useState(todayISO());
  const [wakeTime, setWakeTime] = useState('');
  const [applicationsSent, setApplicationsSent] = useState('0');
  const [tradingInPlan, setTradingInPlan] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const entry: AnchorLogInsert = {
      log_date: logDate,
      wake_time: wakeTime || null,
      applications_sent: parseInt(applicationsSent, 10) || 0,
      trading_in_plan: tradingInPlan,
      note: note || null,
    };

    const { error: insertError } = await supabase.from('anchor_logs').insert(entry);
    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setWakeTime('');
    setApplicationsSent('0');
    setTradingInPlan(false);
    setNote('');
    setLoading(false);
    onLogged();
    setTimeout(() => setSuccess(false), 2500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Log today's anchors</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="log-date">Date</Label>
              <Input
                id="log-date"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wake-time">Wake time</Label>
              <Input
                id="wake-time"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="applications-sent">Applications sent</Label>
            <Input
              id="applications-sent"
              type="number"
              min="0"
              value={applicationsSent}
              onChange={(e) => setApplicationsSent(e.target.value)}
            />
          </div>

          <AnchorToggle
            label="Trading in-plan"
            description="Did your trading stay within your plan today?"
            checked={tradingInPlan}
            onChange={setTradingInPlan}
          />

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Reflection, what went well, what to adjust..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="h-4 w-4" /> Anchor logged — appended to history.
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Log entry
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AnchorToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
        checked
          ? 'border-primary bg-primary/10'
          : 'border-border bg-background hover:border-muted-foreground'
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
