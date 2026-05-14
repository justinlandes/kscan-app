import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { PrivacyToggle } from '../components/PrivacyToggle';
import {
  buildPrivacyUpdatePatch,
  canToggleSaleSharing,
  normalizePrivacySettings,
} from '../services/privacyPolicy';
import {
  ensurePrivacySettings,
  fetchProfile,
  isPrivacyBackendConfigured,
  requestCorrection,
  requestDataExport,
  requestDeletion,
  updatePrivacySettings,
} from '../services/supabasePrivacy';
import { COLORS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

const PRIVACY_COPY = {
  saleSharing:
    'Opt out of sale or sharing of personal information linked to style preferences, app interactions, and account-level behavioral data.',
  sensitive:
    'Limit sensitive processing where applicable. Operational diagnostics and security events may still be processed where permitted.',
  aggregate:
    'Aggregated or deidentified trend reports are managed separately from transfers of user-linked personal information.',
  scans:
    'Raw scan storage must follow the production storage map. Derived fashion metadata may be reviewed for export when linked to your account.',
  minor:
    'Sale or sharing of personal information is disabled for users under 16 unless legally valid authorization is obtained.',
};

export default function PrivacyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>({ age_group: 'unknown', account_status: 'active' });
  const [settings, setSettings] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState('');

  const configured = isPrivacyBackendConfigured();
  const normalized = useMemo(() => normalizePrivacySettings(settings, profile), [settings, profile]);
  const saleSharingLocked = !canToggleSaleSharing(normalized.age_group);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (!configured) {
        setMessage('Sign in is required before mobile privacy controls can sync with Supabase.');
        return;
      }
      const [settingsRow, profileRow] = await Promise.all([ensurePrivacySettings(), fetchProfile()]);
      setProfile(profileRow ?? { age_group: 'unknown', account_status: 'active' });
      setSettings(settingsRow);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load privacy settings.');
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (nextSettings: any) => {
    setSaving(true);
    setMessage(null);
    try {
      const patch = buildPrivacyUpdatePatch(nextSettings, profile);
      const updated = await updatePrivacySettings(patch);
      setSettings(updated ?? { ...settings, ...patch });
      setMessage('Privacy settings updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletion = () => {
    Alert.alert(
      'Request account deletion?',
      'Your account will be marked pending deletion while K Scan AI processes required retention, security, and legal checks.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const result = await requestDeletion();
              setMessage(result.status === 'already_requested' ? 'Deletion was already requested.' : 'Deletion request submitted.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Unable to request deletion.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleExport = async () => {
    setSaving(true);
    try {
      await requestDataExport();
      setMessage('Data export request submitted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request export.');
    } finally {
      setSaving(false);
    }
  };

  const handleCorrection = async () => {
    if (!correctionText.trim()) {
      setMessage('Describe the account information you want corrected.');
      return;
    }
    setSaving(true);
    try {
      await requestCorrection({ user_description: correctionText.trim() });
      setCorrectionText('');
      setMessage('Correction request submitted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request correction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brand}>K-SCAN</Text>
          <Text style={styles.screenTitle}>PRIVACY CONTROL</Text>
        </View>
        <View style={styles.headerRight} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>DATA MANAGEMENT</Text>
          <Text style={styles.title}>Your Privacy Choices</Text>
          <Text style={styles.body}>
            Manage sale or sharing opt-out, sensitive processing limits, access requests, correction architecture, and deletion requests from the mobile app.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color="#00FFFF" />
          </View>
        ) : (
          <>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            {saleSharingLocked ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>UNDER-16 PROTECTION ACTIVE</Text>
                <Text style={styles.noticeBody}>{PRIVACY_COPY.minor}</Text>
              </View>
            ) : null}

            <PrivacyToggle
              title="Do Not Sell or Share"
              body={PRIVACY_COPY.saleSharing}
              value={normalized.opt_out_of_sale}
              disabled={!configured || saving || saleSharingLocked}
              onChange={(value) => persist({ ...normalized, opt_out_of_sale: value })}
            />

            <PrivacyToggle
              title="Limit Sensitive Processing"
              body={PRIVACY_COPY.sensitive}
              value={normalized.limit_sensitive_processing}
              disabled={!configured || saving}
              onChange={(value) => persist({ ...normalized, limit_sensitive_processing: value })}
            />

            <View style={styles.infoPanel}>
              <Text style={styles.panelTitle}>DATA CATEGORY BOUNDARIES</Text>
              <Text style={styles.panelBody}>{PRIVACY_COPY.aggregate}</Text>
              <Text style={styles.panelBody}>{PRIVACY_COPY.scans}</Text>
              <Text style={styles.panelBody}>
                Global Privacy Control from web is synchronized through the gpc_web source and should keep sale/sharing opt-out enabled.
              </Text>
              <Text style={styles.panelBody}>
                GDPR consent requires separate EU/UK logic and is not inferred from California opt-out state.
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable disabled={!configured || saving} style={styles.secondaryButton} onPress={handleExport}>
                <Text style={styles.secondaryButtonText}>Request Data Export</Text>
              </Pressable>

              <View style={styles.correctionBox}>
                <TextInput
                  value={correctionText}
                  onChangeText={setCorrectionText}
                  placeholder="Describe a correction request"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  style={styles.input}
                />
                <Pressable disabled={!configured || saving} style={styles.secondaryButton} onPress={handleCorrection}>
                  <Text style={styles.secondaryButtonText}>Submit Correction Request</Text>
                </Pressable>
              </View>

              <Pressable disabled={!configured || saving} style={styles.dangerButton} onPress={handleDeletion}>
                <Text style={styles.dangerButtonText}>Request Account Deletion</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: LAYOUT.safeTop,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 56,
  },
  backText: {
    color: '#00FFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 56,
  },
  brand: {
    ...TYPOGRAPHY.brand,
    fontSize: 16,
  },
  screenTitle: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
    color: '#00FFFF',
  },
  content: {
    padding: LAYOUT.screenPadding,
    gap: SPACING.lg,
    paddingBottom: 56,
  },
  hero: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  eyebrow: {
    ...TYPOGRAPHY.caption,
    color: '#00FFFF',
  },
  title: {
    ...TYPOGRAPHY.headline,
    fontSize: 28,
  },
  body: {
    ...TYPOGRAPHY.body,
  },
  loadingPanel: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...TYPOGRAPHY.bodyStrong,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    color: COLORS.textPrimary,
  },
  notice: {
    borderWidth: 1,
    borderColor: '#00FFFF',
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  noticeTitle: {
    ...TYPOGRAPHY.caption,
    color: '#00FFFF',
  },
  noticeBody: {
    ...TYPOGRAPHY.bodyStrong,
  },
  infoPanel: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  panelTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
  },
  panelBody: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    gap: SPACING.md,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceSoft,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.cta,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  correctionBox: {
    gap: SPACING.sm,
  },
  input: {
    minHeight: 96,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    textAlignVertical: 'top',
  },
  dangerButton: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  dangerButtonText: {
    ...TYPOGRAPHY.cta,
    color: COLORS.errorSoft,
    fontSize: 12,
  },
});
