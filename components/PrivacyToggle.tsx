import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

interface PrivacyToggleProps {
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export function PrivacyToggle({ title, body, value, disabled, onChange }: PrivacyToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.row, value && styles.rowActive, disabled && styles.rowDisabled]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <View style={[styles.track, value && styles.trackActive, disabled && styles.trackDisabled]}>
        <View style={[styles.thumb, value && styles.thumbActive]} />
      </View>
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
