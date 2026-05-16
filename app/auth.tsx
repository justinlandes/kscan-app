import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { useAuthSession } from '../contexts/AuthSessionContext';
import { COLORS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { validateAuthInput, mapAuthError } from '../services/authValidation';

type AuthMode = 'sign-in' | 'create-account';
type AuthStep = 'idle' | 'submitting' | 'confirm-email';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, isAuthenticated } = useAuthSession();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<AuthStep>('idle');
  const [error, setError] = useState<string | null>(null);

  // Navigate away when a session appears (sign-in or immediate signup without email confirmation)
  useEffect(() => {
    if (isAuthenticated) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  }, [isAuthenticated, router]);

  const busy = step === 'submitting';

  const switchMode = (newMode: AuthMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setError(null);
    setStep('idle');
    setConfirmPassword('');
    // Preserve email so the user doesn't have to retype it
  };

  const handleSubmit = async () => {
    const validation = validateAuthInput(mode, email, password, confirmPassword);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError(null);
    setStep('submitting');
    try {
      if (mode === 'sign-in') {
        await signIn(email.trim(), password);
        // isAuthenticated useEffect handles navigation
      } else {
        const result = await signUp(email.trim(), password);
        if (result.confirmationRequired) {
          // Case B: email confirmation required — show inline panel
          setStep('confirm-email');
        }
        // Case A: session created — isAuthenticated useEffect handles navigation
      }
    } catch (err) {
      setStep('idle');
      const raw = err instanceof Error ? err.message : 'Something went wrong. Try again.';
      setError(mapAuthError(raw, mode));
    }
  };

  // Invoked from the confirmation panel: return to sign-in mode
  const handleBackToSignIn = () => {
    setMode('sign-in');
    setStep('idle');
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  // ── Email confirmation panel (Case B) ────────────────────────────────────────

  if (step === 'confirm-email') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Cancel</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.brand}>K-SCAN</Text>
            <Text style={styles.screenTitle}>ACCOUNT ACCESS</Text>
          </View>
          <View style={styles.headerRight} />
        </SafeAreaView>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Check Your Email</Text>
            <Text style={styles.cardBody}>
              We sent a confirmation link to{' '}
              <Text style={styles.emailHighlight}>{email.trim()}</Text>. Open the link to verify
              your account, then sign in below.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handleBackToSignIn}>
              <Text style={styles.primaryButtonText}>SIGN IN</Text>
            </Pressable>
          </View>
          <Text style={styles.footNote}>
            Didn't receive it? Check your spam folder, or try creating the account again.
          </Text>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Main auth card ────────────────────────────────────────────────────────────

  const screenTitle = mode === 'sign-in' ? 'SIGN IN' : 'CREATE ACCOUNT';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} disabled={busy}>
          <Text style={[styles.backText, busy && styles.disabled]}>Cancel</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brand}>K-SCAN</Text>
          <Text style={styles.screenTitle}>{screenTitle}</Text>
        </View>
        <View style={styles.headerRight} />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          {/* Mode switcher tabs */}
          <View style={styles.tabRow}>
            <Pressable
              style={styles.tab}
              onPress={() => switchMode('sign-in')}
              disabled={busy}
            >
              <Text style={[styles.tabText, mode === 'sign-in' && styles.tabTextActive]}>
                SIGN IN
              </Text>
              {mode === 'sign-in' ? <View style={styles.tabIndicator} /> : <View style={styles.tabIndicatorInvisible} />}
            </Pressable>
            <Pressable
              style={styles.tab}
              onPress={() => switchMode('create-account')}
              disabled={busy}
            >
              <Text style={[styles.tabText, mode === 'create-account' && styles.tabTextActive]}>
                CREATE ACCOUNT
              </Text>
              {mode === 'create-account' ? <View style={styles.tabIndicator} /> : <View style={styles.tabIndicatorInvisible} />}
            </Pressable>
          </View>

          <Text style={styles.cardBody}>
            {mode === 'sign-in'
              ? 'Sign in to save your privacy preferences across devices and access account management.'
              : 'Create an account to sync your privacy preferences and manage your K Scan data.'}
          </Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!busy}
              style={[styles.input, busy && styles.inputDisabled]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'sign-in' ? 'password' : 'new-password'}
              autoCorrect={false}
              editable={!busy}
              onSubmitEditing={mode === 'sign-in' ? handleSubmit : undefined}
              style={[styles.input, busy && styles.inputDisabled]}
            />
          </View>

          {mode === 'create-account' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                editable={!busy}
                onSubmitEditing={handleSubmit}
                style={[styles.input, busy && styles.inputDisabled]}
              />
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, busy && styles.primaryButtonBusy]}
            onPress={handleSubmit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'sign-in' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={() => switchMode(mode === 'sign-in' ? 'create-account' : 'sign-in')}
          disabled={busy}
          style={styles.secondaryLinkRow}
        >
          <Text style={styles.secondaryLink}>
            {mode === 'sign-in' ? 'Need an account? ' : 'Already have an account? '}
            <Text style={styles.secondaryLinkAction}>
              {mode === 'sign-in' ? 'Create one' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>

        <Text style={styles.footNote}>
          Privacy preferences are protected by row-level security. Your choices are visible only to your account.
        </Text>
      </KeyboardAvoidingView>
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
  disabled: {
    opacity: 0.4,
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
  body: {
    flex: 1,
    padding: LAYOUT.screenPadding,
    gap: SPACING.lg,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  // Mode switcher tabs
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  tabText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  tabTextActive: {
    color: '#00FFFF',
  },
  tabIndicator: {
    height: 2,
    width: 28,
    backgroundColor: '#00FFFF',
    borderRadius: 1,
  },
  tabIndicatorInvisible: {
    height: 2,
    width: 28,
  },
  cardTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 20,
  },
  cardBody: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 20,
  },
  emailHighlight: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  errorBanner: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.45)',
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    padding: SPACING.md,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.errorSoft,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  input: {
    height: 50,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgElevated,
    fontSize: 15,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  primaryButtonBusy: {
    opacity: 0.7,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.cta,
    color: COLORS.textInverse,
    fontSize: 13,
  },
  secondaryLinkRow: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  secondaryLink: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  secondaryLinkAction: {
    color: '#00FFFF',
    fontWeight: '600',
  },
  footNote: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});
