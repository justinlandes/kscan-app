import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  buildPrivacyUpdatePatch,
  normalizePrivacySettings,
} from '../services/privacyPolicy';
import { readPrivacyLocal, writePrivacyLocal } from '../services/privacyLocalStore';
import {
  ensurePrivacySettings,
  fetchProfile,
  isPrivacyBackendConfigured,
  isSupabaseProjectConfigured,
  updatePrivacySettings,
} from '../services/supabasePrivacy';

const DEFAULT_PROFILE = { age_group: 'unknown', account_status: 'active' as const };

type BootStatus = 'loading' | 'ready';

export type PrivacyPreferenceSource = 'remote' | 'local';

export interface PrivacyPreferencesContextValue {
  bootStatus: BootStatus;
  /** True when EXPO_PUBLIC_SUPABASE_URL + ANON + access token are all set (RLS-scoped REST). */
  remoteSessionActive: boolean;
  /** True when URL + anon exist (Supabase project is referenced). */
  supabaseProjectPresent: boolean;
  remoteFetchFailed: boolean;
  remoteFetchError: string | null;
  preferenceSource: PrivacyPreferenceSource;
  normalized: ReturnType<typeof normalizePrivacySettings>;
  profile: { age_group: string; account_status?: string };
  saving: boolean;
  refresh: () => Promise<void>;
  persistPreference: (patch: {
    opt_out_of_sale?: boolean;
    limit_sensitive_processing?: boolean;
  }) => Promise<void>;
}

const PrivacyPreferencesContext = createContext<PrivacyPreferencesContextValue | null>(null);

function buildSettingsFromRemote(remote: Record<string, unknown> | null, local: { opt_out_of_sale: boolean; limit_sensitive_processing: boolean }) {
  if (remote) return remote;
  return {
    user_id: null,
    opt_out_of_sale: local.opt_out_of_sale,
    limit_sensitive_processing: local.limit_sensitive_processing,
    gdpr_consent_given: null,
    gdpr_consent_timestamp: null,
    gdpr_consent_version: null,
    consent_version: 'ccpa_cpra_mobile_v1',
    last_request_source: null,
    last_processed_at: null,
    updated_at: null,
  };
}

export function PrivacyPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [bootStatus, setBootStatus] = useState<BootStatus>('loading');
  const [remoteRow, setRemoteRow] = useState<Record<string, unknown> | null>(null);
  const [profile, setProfile] = useState<{ age_group: string; account_status?: string }>(DEFAULT_PROFILE);
  const [localPrefs, setLocalPrefs] = useState({ opt_out_of_sale: false, limit_sensitive_processing: false });
  const [remoteFetchFailed, setRemoteFetchFailed] = useState(false);
  const [remoteFetchError, setRemoteFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const remoteSessionActive = isPrivacyBackendConfigured();
  const supabaseProjectPresent = isSupabaseProjectConfigured();

  const preferenceSource: PrivacyPreferenceSource =
    remoteSessionActive && remoteRow != null && !remoteFetchFailed ? 'remote' : 'local';

  const normalized = useMemo(
    () => normalizePrivacySettings(buildSettingsFromRemote(remoteRow, localPrefs), profile),
    [remoteRow, localPrefs, profile]
  );

  const snapshotRef = useRef({
    remoteRow,
    localPrefs,
    profile,
    normalized,
    remoteFetchFailed,
  });
  snapshotRef.current = { remoteRow, localPrefs, profile, normalized, remoteFetchFailed };

  const hydrate = useCallback(async () => {
    setBootStatus('loading');
    setRemoteFetchFailed(false);
    setRemoteFetchError(null);

    let local = { opt_out_of_sale: false, limit_sensitive_processing: false };
    try {
      local = await readPrivacyLocal();
    } catch {
      // keep defaults
    }
    setLocalPrefs(local);

    if (remoteSessionActive) {
      try {
        const [settingsRow, profileRow] = await Promise.all([
          ensurePrivacySettings(),
          fetchProfile(),
        ]);
        setRemoteRow((settingsRow ?? null) as Record<string, unknown> | null);
        setProfile(
          profileRow && typeof profileRow === 'object' && 'age_group' in profileRow
            ? {
                age_group: String((profileRow as { age_group?: string }).age_group || 'unknown'),
                account_status: (profileRow as { account_status?: string }).account_status,
              }
            : DEFAULT_PROFILE
        );
      } catch (error) {
        setRemoteRow(null);
        setRemoteFetchFailed(true);
        setRemoteFetchError(error instanceof Error ? error.message : 'Unable to load privacy settings.');
        setProfile(DEFAULT_PROFILE);
      }
    } else {
      setRemoteRow(null);
    }

    setBootStatus('ready');
  }, [remoteSessionActive]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const persistPreference = useCallback(
    async (patch: { opt_out_of_sale?: boolean; limit_sensitive_processing?: boolean }) => {
      const snap = snapshotRef.current;
      setSaving(true);
      try {
        const canWriteRemote =
          isPrivacyBackendConfigured() && snap.remoteRow != null && !snap.remoteFetchFailed;
        if (canWriteRemote) {
          const merged = { ...snap.normalized, ...patch };
          const body = buildPrivacyUpdatePatch(merged, snap.profile);
          const updated = await updatePrivacySettings(body);
          setRemoteRow((updated ?? { ...snap.remoteRow, ...body }) as Record<string, unknown>);
          setRemoteFetchFailed(false);
          setRemoteFetchError(null);
        } else {
          const written = await writePrivacyLocal(patch);
          setLocalPrefs({
            opt_out_of_sale: written.opt_out_of_sale,
            limit_sensitive_processing: written.limit_sensitive_processing,
          });
        }
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const value = useMemo<PrivacyPreferencesContextValue>(
    () => ({
      bootStatus,
      remoteSessionActive,
      supabaseProjectPresent,
      remoteFetchFailed,
      remoteFetchError,
      preferenceSource,
      normalized,
      profile,
      saving,
      refresh: hydrate,
      persistPreference,
    }),
    [
      bootStatus,
      remoteSessionActive,
      supabaseProjectPresent,
      remoteFetchFailed,
      remoteFetchError,
      preferenceSource,
      normalized,
      profile,
      saving,
      hydrate,
      persistPreference,
    ]
  );

  return (
    <PrivacyPreferencesContext.Provider value={value}>{children}</PrivacyPreferencesContext.Provider>
  );
}

export function usePrivacyPreferences(): PrivacyPreferencesContextValue {
  const ctx = useContext(PrivacyPreferencesContext);
  if (!ctx) {
    throw new Error('usePrivacyPreferences must be used within PrivacyPreferencesProvider');
  }
  return ctx;
}
