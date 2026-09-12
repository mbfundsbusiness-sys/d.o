'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, type UserSettings } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/provider';

type SaveInput = Partial<
  Pick<UserSettings, 'jummah_time' | 'jummah_duration_min' | 'timezone' | 'prayer_times' | 'backdrop'>
>;

type UseUserSettings = {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  save: (patch: SaveInput) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useUserSettings(): UseUserSettings {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: selErr } = await supabase
      .from('user_settings')
      .select('*')
      .maybeSingle();

    if (selErr) {
      setError(selErr.message);
      setLoading(false);
      return;
    }

    if (data) {
      setSettings(data as UserSettings);
      setLoading(false);
      return;
    }

    // No row yet — create one with defaults.
    const { data: created, error: insErr } = await supabase
      .from('user_settings')
      .insert({})
      .select()
      .single();
    if (insErr) {
      setError(insErr.message);
    } else {
      setSettings(created as UserSettings);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: SaveInput) => {
      setError(null);
      const { data, error: updErr } = await supabase
        .from('user_settings')
        .update(patch)
        .eq('user_id', user?.id ?? '')
        .select()
        .single();
      if (updErr) {
        setError(updErr.message);
        throw new Error(updErr.message);
      }
      setSettings(data as UserSettings);
    },
    [user]
  );

  return { settings, loading, error, save, refresh };
}
