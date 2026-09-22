'use client';

import { useEffect, useState } from 'react';
import { useUserSettings } from '@/lib/settings/use-user-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { fmtHM } from '@/lib/utils/dates';
import type { PrayerName, PrayerTimes } from '@/lib/supabase/client';
import { BACKDROP_PRESETS, applyBackdrop, getStoredBackdrop, isBackdropId, type BackdropId } from '@/lib/backdrop';
import { NAV_ITEMS, ALWAYS_VISIBLE_HREFS } from '@/lib/nav-items';
import { cn } from '@/lib/utils';

type PermState = 'unsupported' | NotificationPermission;

const PRAYER_ORDER: { name: PrayerName; label: string }[] = [
  { name: 'fajr', label: 'Fajr' },
  { name: 'dhuhr', label: 'Dhuhr' },
  { name: 'asr', label: 'Asr' },
  { name: 'maghrib', label: 'Maghrib' },
  { name: 'isha', label: 'Isha' },
];

export default function SettingsPage() {
  const { settings, loading, error, save } = useUserSettings();
  const [jummahTime, setJummahTime] = useState('');
  const [jummahDuration, setJummahDuration] = useState('60');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [perm, setPerm] = useState<PermState>('default');
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>({});
  const [savingPrayers, setSavingPrayers] = useState(false);
  const [prayersSaved, setPrayersSaved] = useState(false);
  const [prayersError, setPrayersError] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<BackdropId>('aurora');
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  const [modulesError, setModulesError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Notification === 'undefined') setPerm('unsupported');
    else setPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (settings) {
      setJummahTime(settings.jummah_time ? fmtHM(settings.jummah_time) : '');
      setJummahDuration(String(settings.jummah_duration_min ?? 60));
      setPrayerTimes(settings.prayer_times ?? {});
      setBackdrop(isBackdropId(settings.backdrop) ? settings.backdrop : getStoredBackdrop());
      setHiddenModules(settings.hidden_modules ?? []);
    } else {
      setBackdrop(getStoredBackdrop());
    }
  }, [settings]);

  async function handleToggleModule(href: string, hide: boolean) {
    const next = hide ? [...hiddenModules, href] : hiddenModules.filter((h) => h !== href);
    setHiddenModules(next);
    setModulesError(null);
    try {
      await save({ hidden_modules: next });
    } catch (err) {
      setModulesError(err instanceof Error ? err.message : 'Could not save');
      setHiddenModules(hiddenModules); // revert on failure
    }
  }

  async function handlePickBackdrop(id: BackdropId) {
    setBackdrop(id);
    applyBackdrop(id); // instant, no need to wait on the network
    try {
      await save({ backdrop: id });
    } catch {
      // applied locally either way — background sync failure isn't worth surfacing here
    }
  }

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

  async function handleSavePrayerTimes() {
    setSavingPrayers(true);
    setPrayersSaved(false);
    setPrayersError(null);
    try {
      await save({ prayer_times: prayerTimes });
      setPrayersSaved(true);
    } catch (err) {
      setPrayersError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSavingPrayers(false);
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
          <CardTitle className="text-lg">Prayer times (manual override)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The Prayer page now calculates and schedules Fajr–Isha automatically for London, so
            this manual field is no longer needed for alerts — it's kept here only in case you
            ever want to override a specific time by hand.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {PRAYER_ORDER.map((p) => (
              <div key={p.name} className="space-y-2">
                <Label htmlFor={`prayer-${p.name}`}>{p.label}</Label>
                <Input
                  id={`prayer-${p.name}`}
                  type="time"
                  value={prayerTimes[p.name] ? fmtHM(prayerTimes[p.name]!) : ''}
                  onChange={(e) =>
                    setPrayerTimes((prev) => ({ ...prev, [p.name]: e.target.value || undefined }))
                  }
                />
              </div>
            ))}
          </div>
          {prayersError && <p className="text-sm text-destructive">{prayersError}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={handleSavePrayerTimes} disabled={savingPrayers}>
              {savingPrayers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            {prayersSaved && <span className="text-sm text-muted-foreground">Saved.</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Backdrop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The colour wash behind the app. Applies instantly and syncs to your other devices.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BACKDROP_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePickBackdrop(preset.id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors',
                  backdrop === preset.id ? 'border-foreground' : 'border-border hover:border-foreground/40'
                )}
              >
                <div className="h-10 w-full overflow-hidden rounded-md bg-secondary">
                  {preset.swatch.length > 0 && (
                    <div
                      className="h-full w-full"
                      style={{
                        background: `linear-gradient(90deg, ${preset.swatch.join(', ')})`,
                      }}
                    />
                  )}
                </div>
                <span className="text-xs font-medium">{preset.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hide modules you don't use from the sidebar. Nothing is deleted — turn one back on any
            time to see its data again.
          </p>
          {modulesError && <p className="text-sm text-destructive">{modulesError}</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NAV_ITEMS.filter((item) => !ALWAYS_VISIBLE_HREFS.includes(item.href)).map((item) => {
              const Icon = item.icon;
              const isHidden = hiddenModules.includes(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => handleToggleModule(item.href, !isHidden)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors',
                    isHidden
                      ? 'border-border text-muted-foreground opacity-60'
                      : 'border-foreground/30 bg-white/[0.04]'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                    {isHidden ? 'Hidden' : 'Shown'}
                  </span>
                </button>
              );
            })}
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
