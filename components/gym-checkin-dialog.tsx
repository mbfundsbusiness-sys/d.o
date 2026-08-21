'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type GymCheckinDialogProps = {
  open: boolean;
  weekNumber: number;
  onClose: () => void;
  onSubmit: (data: { soreness: number; sleep_quality: number; motivation: number; pain_flag: boolean; notes: string }) => Promise<void>;
};

function ScaleRow({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors',
              value === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent/5'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function GymCheckinDialog({ open, weekNumber, onClose, onSubmit }: GymCheckinDialogProps) {
  const [soreness, setSoreness] = useState(3);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [painFlag, setPainFlag] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleReset() {
    setSoreness(3);
    setSleepQuality(3);
    setMotivation(3);
    setPainFlag(false);
    setNotes('');
    setError(null);
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await onSubmit({ soreness, sleep_quality: sleepQuality, motivation, pain_flag: painFlag, notes: notes.trim() });
      handleReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit check-in');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recovery check-in</DialogTitle>
          <DialogDescription>
            Before week {weekNumber + 1} is generated — this shapes whether it progresses or backs off.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ScaleRow label="Soreness" value={soreness} onChange={setSoreness} lowLabel="None" highLabel="Very sore" />
          <ScaleRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} lowLabel="Poor" highLabel="Great" />
          <ScaleRow label="Motivation" value={motivation} onChange={setMotivation} lowLabel="Low" highLabel="High" />

          <button
            type="button"
            onClick={() => setPainFlag(!painFlag)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              painFlag ? 'border-destructive bg-destructive/5' : 'border-border hover:bg-accent/5'
            )}
          >
            <div className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
              painFlag ? 'border-destructive bg-destructive' : 'border-muted-foreground'
            )} />
            <div>
              <p className="text-sm font-medium">Any pain (not just soreness)?</p>
              <p className="text-xs text-muted-foreground">Joint pain, sharp pain, anything beyond normal muscle fatigue.</p>
            </div>
          </button>

          <div className="space-y-2">
            <Label htmlFor="checkin-notes" className="text-sm">Notes (optional)</Label>
            <Textarea
              id="checkin-notes"
              placeholder="Anything else worth factoring into next week..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit and generate next week
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
