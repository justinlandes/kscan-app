import React, { useState } from 'react';
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

type AuthStep = 'idle' | 'signing-in' | 'success';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, isAuthenticated } = useAuthSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<AuthStep>('idle');
  const [error, setError] = useState<string | null>(null);

  // If already signed in, go back
  if (isAuthenticated) {
    router.back();
    return null;
  }

  const busy = step === 'signing-in';

  const handleSignIn = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setStep('signing-in');
    try {
      await signIn(trimmedEmail, password);
      setStep('success');
      // Navigate back — privacy screen will react to the new session
      router.back();
    } catch (err) {
      setStep('idle');
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Check your credentials.';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError('Email or password is incorrect. Try again.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('Network error. Check your connection and try again.');
      } else {
        setError(msg);
      }
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} disabled={busy}>
          <Text style={[styles.backText, busy && styles.disabled]}>Cancel</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brand}>K-SCAN</Text>
          <Text style={styles.screenTitle}>SIGN IN</Text>
        </View>
        <View style={styles.headerRight} />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Sign In</Text>
          <Text style={styles.cardBody}>
            Sign in to save your privacy preferences across devices and access account management.
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
              autoComplete="password"
              autoCorrect={false}
              editable={!busy}
              onSubmitEditing={handleSignIn}
              style={[styles.input, busy && styles.inputDisabled]}
            />
          </View>

          <Pressable
            style={[styles.primaryButton, busy && styles.primaryButtonBusy]}
            onPress={handleSignIn}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>SIGN IN</Text>
            )}
          </Pressable>
        </View>

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
  cardTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 20,
  },
  cardBody: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 20,
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
  footNote: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});
