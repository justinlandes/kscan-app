import React, { useMemo, useState } from 'react';
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
import { canToggleSaleSharing } from '../services/privacyPolicy';
import {
  requestCorrection,
  requestDataExport,
  requestDeletion,
} from '../services/supabasePrivacy';
import { usePrivacyPreferences } from '../contexts/PrivacyPreferencesContext';
import { COLORS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

const PRIVACY_COPY = {
  saleRemote:
    'When enabled, K Scan will treat your account as opted out of applicable data sale or sharing preferences, subject to our Privacy Policy and legal obligations.',
  saleLocal:
    'This preference is currently saved on this device. Account-level syncing will activate when sign-in support is available.',
  sensitiveRemote:
    'Limit sensitive processing where applicable. Operational diagnostics and security events may still be processed where permitted.',
  sensitiveLocal:
    'Stored on this device until your account is connected. Operational diagnostics on this device may still run where permitted.',
  aggregate:
    'Aggregated or deidentified trend reports are managed separately from transfers of user-linked personal information.',
  scans:
    'Raw scan storage must follow the production storage map. Derived fashion metadata may be reviewed for export when linked to your account.',
  minor:
    'Sale or sharing of personal information is disabled for users under 16 unless legally valid authorization is obtained.',
};

export default function PrivacyScreen() {
  const router = useRouter();
  const {
    bootStatus,
    remoteSessionActive,
    supabaseProjectPresent,
    remoteFetchFailed,
    remoteFetchError,
    preferenceSource,
    normalized,
    saving,
    persistPreference,
  } = usePrivacyPreferences();

  const [message, setMessage] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState('');

  const saleSharingLocked = !canToggleSaleSharing(normalized.age_group);

  const remoteActionsEnabled =
    remoteSessionActive && !remoteFetchFailed && preferenceSource === 'remote';

  const showSignInHint = supabaseProjectPresent && !remoteSessionActive;

  const saleBody = preferenceSource === 'remote' ? PRIVACY_COPY.saleRemote : PRIVACY_COPY.saleLocal;
  const sensitiveBody =
    preferenceSource === 'remote' ? PRIVACY_COPY.sensitiveRemote : PRIVACY_COPY.sensitiveLocal;

  const loadFailureBanner = useMemo(() => {
    if (!remoteFetchFailed) return null;
    return (
      <View style={styles.errorBanner}>
        <Text style={styles.errorBannerTitle}>Unable to load your privacy preference right now.</Text>
        <Text style={styles.errorBannerBody}>
          {remoteFetchError || 'Check your connection and try again.'} Showing the last-known preference saved on this device until the account sync succeeds.
        </Text>
      </View>
    );
  }, [remoteFetchFailed, remoteFetchError]);

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
            try {
              const result = await requestDeletion();
              setMessage(result.status === 'already_requested' ? 'Deletion was already requested.' : 'Deletion request submitted.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Unable to request deletion.');
            }
          },
        },
      ],
    );
  };

  const handleExport = async () => {
    try {
      await requestDataExport();
      setMessage('Data export request submitted (if your Edge Function is deployed and reachable).');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request export.');
    }
  };

  const handleCorrection = async () => {
    if (!correctionText.trim()) {
      setMessage('Describe the account information you want corrected.');
      return;
    }
    try {
      await requestCorrection({ user_description: correctionText.trim() });
      setCorrectionText('');
      setMessage('Correction request submitted (if your Edge Function is deployed and reachable).');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request correction.');
    }
  };

  const loading = bootStatus === 'loading';

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
            Review sale and sharing opt-outs, sensitive processing limits, and account requests. Advanced actions require a live Supabase session and deployed Edge Functions.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color="#00FFFF" />
            <Text style={styles.loadingCaption}>Loading your preferences…</Text>
          </View>
        ) : (
          <>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {loadFailureBanner}

            {showSignInHint ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>SIGN IN TO SYNC</Text>
                <Text style={styles.noticeBody}>
                  Sign in to save privacy preferences across devices. Until an authenticated session is available, only on-device preferences below are applied.
                </Text>
              </View>
            ) : null}

            {saleSharingLocked ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>UNDER-16 PROTECTION ACTIVE</Text>
                <Text style={styles.noticeBody}>{PRIVACY_COPY.minor}</Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Privacy & Data Choices</Text>
              <Text style={styles.sectionSubtitle}>
                {preferenceSource === 'remote'
                  ? 'These choices sync to your K Scan account via Supabase.'
                  : 'On-device preferences — not yet synced to an account.'}
              </Text>

              <PrivacyToggle
                title="Do Not Sell or Share My Personal Information"
                body={saleBody}
                value={normalized.opt_out_of_sale}
                busy={saving}
                disabled={saving || saleSharingLocked}
                onChange={(value) => {
                  setMessage(null);
                  void persistPreference({ opt_out_of_sale: value }).catch((error) => {
                    setMessage(error instanceof Error ? error.message : 'Unable to update preference.');
                  });
                }}
              />

              <PrivacyToggle
                title="Limit Sensitive Processing"
                body={sensitiveBody}
                value={normalized.limit_sensitive_processing}
                busy={saving}
                disabled={saving}
                onChange={(value) => {
                  setMessage(null);
                  void persistPreference({ limit_sensitive_processing: value }).catch((error) => {
                    setMessage(error instanceof Error ? error.message : 'Unable to update preference.');
                  });
                }}
              />
            </View>

            <View style={styles.infoPanel}>
              <Text style={styles.panelTitle}>DATA CATEGORY BOUNDARIES</Text>
              <Text style={styles.panelBody}>{PRIVACY_COPY.aggregate}</Text>
              <Text style={styles.panelBody}>{PRIVACY_COPY.scans}</Text>
              <Text style={styles.panelBody}>
                Global Privacy Control from web is synchronized through the gpc_web source when your account is connected.
              </Text>
              <Text style={styles.panelBody}>
                GDPR consent requires separate EU/UK logic and is not inferred from California opt-out state.
              </Text>
            </View>

            <View style={styles.actions}>
              {!remoteActionsEnabled ? (
                <Text style={styles.edgeHint}>
                  Data export, correction, and deletion requests require an authenticated Supabase session and deployed Edge Functions (handle-user-deletion, privacy-data-export, privacy-correction-request). They are not active until those pieces are live in your project.
                </Text>
              ) : null}

              <Pressable disabled={!remoteActionsEnabled || saving} style={styles.secondaryButton} onPress={handleExport}>
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
                <Pressable disabled={!remoteActionsEnabled || saving} style={styles.secondaryButton} onPress={handleCorrection}>
                  <Text style={styles.secondaryButtonText}>Submit Correction Request</Text>
                </Pressable>
              </View>

              <Pressable disabled={!remoteActionsEnabled || saving} style={styles.dangerButton} onPress={handleDeletion}>
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
    gap: SPACING.md,
  },
  loadingCaption: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
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
  errorBanner: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.45)',
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  errorBannerTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.errorSoft,
  },
  errorBannerBody: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 20,
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
  sectionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
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
  edgeHint: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textTertiary,
    marginBottom: SPACING.sm,
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
