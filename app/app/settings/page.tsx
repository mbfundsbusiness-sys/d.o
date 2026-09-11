'use client';

import { useEffect, useState } from 'react';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { fmtHM } from '@/lib/utils/dates';

type PermState = 'unsupported' | NotificationPermission;

export default function SettingsPage() {
  const { settings, loading, error, save } = useUserSettings();
  const [jummahTime, setJummahTime] = useState('');
  const [jummahDuration, setJummahDuration] = useState('60');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [perm, setPerm] = useState<PermState>('default');

  useEffect(() => {
    if (typeof Notification === 'undefined') setPerm('unsupported');
    else setPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (settings) {
      setJummahTime(settings.jummah_time ? fmtHM(settings.jummah_time) : '');
      setJummahDuration(String(settings.jummah_duration_min ?? 60));
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await save({
        jummah_time: jummahTime.trim() || null,
        jummah_duration_min: parseInt(jummahDuration, 10) || 60,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPerm(result);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Schedule and notification preferences.
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jummah</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            On Fridays this replaces the midday (~12:30–13:30) block in your schedule. It is
            stored only here — nothing is fetched from an external source.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jummah-time">Jummah time (Europe/London)</Label>
              <Input
                id="jummah-time"
                type="time"
                value={jummahTime}
                onChange={(e) => setJummahTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jummah-duration">Duration (minutes)</Label>
              <Input
                id="jummah-duration"
                type="number"
                min="1"
                value={jummahDuration}
                onChange={(e) => setJummahDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <p className="text-sm text-muted-foreground">
              Europe/London (fixed — all schedule times are London local, DST-aware).
            </p>
          </div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Schedule alerts show an in-app banner 15 minutes before and at the start of each
            block, <span className="font-medium text-foreground">only while the app is open in a
            tab</span>. If you grant browser notification permission, a native notification is
            also shown while the tab is open.
          </p>
          <p className="text-muted-foreground">
            Push notifications that reach you when the app is closed or your device is locked
            are a separate feature and are not available yet.
          </p>
          <div className="flex items-center gap-3 pt-1">
            {perm === 'unsupported' ? (
              <span className="text-muted-foreground">
                This browser does not support notifications.
              </span>
            ) : perm === 'granted' ? (
              <span className="text-muted-foreground">Browser notifications enabled.</span>
            ) : perm === 'denied' ? (
              <span className="text-muted-foreground">
                Browser notifications blocked — the in-app banner still works. Re-enable in your
                browser site settings.
              </span>
            ) : (
              <Button variant="outline" onClick={requestPermission}>
                Enable browser notifications
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
