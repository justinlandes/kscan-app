import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

interface PrivacyToggleProps {
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
  /** Saving to backend or local store — shows inline busy state */
  busy?: boolean;
  onChange: (value: boolean) => void;
}

export function PrivacyToggle({ title, body, value, disabled, busy, onChange }: PrivacyToggleProps) {
  const locked = Boolean(disabled) || Boolean(busy);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: locked }}
      disabled={locked}
      onPress={() => onChange(!value)}
      style={[styles.row, value && styles.rowActive, locked && styles.rowDisabled]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      {busy ? (
        <View style={styles.busySlot}>
          <ActivityIndicator size="small" color="#00FFFF" />
        </View>
      ) : (
        <View style={[styles.track, value && styles.trackActive, locked && styles.trackDisabled]}>
          <View style={[styles.thumb, value && styles.thumbActive]} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 96,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  rowActive: {
    borderColor: '#00FFFF',
  },
  rowDisabled: {
    opacity: 0.66,
  },
  copy: {
    flex: 1,
    gap: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  body: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    lineHeight: 20,
  },
  track: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgElevated,
    padding: 3,
    justifyContent: 'center',
  },
  trackActive: {
    borderColor: '#00FFFF',
    backgroundColor: 'rgba(0, 255, 255, 0.16)',
  },
  trackDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  busySlot: {
    width: 52,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.textTertiary,
  },
  thumbActive: {
    transform: [{ translateX: 20 }],
    backgroundColor: '#00FFFF',
  },
});
