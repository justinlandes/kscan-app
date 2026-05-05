import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, chip } from '../constants/theme';

const EMPTY_VALUE = '\u2014';

interface MetadataChipProps {
  label: string;
  value: string;
}

function formatLabel(label: string) {
  return (label || '').trim().toUpperCase();
}

export function MetadataChip({ label, value }: MetadataChipProps) {
  const displayLabel = formatLabel(label);
  const displayValue = value?.trim() || EMPTY_VALUE;

  return (
    <View
      style={styles.chip}
      accessible
      accessibilityLabel={`${displayLabel}: ${displayValue}`}
    >
      <Text style={styles.label}>{displayLabel}</Text>
      <Text style={styles.value} numberOfLines={2}>
        {displayValue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: chip.minHeight,
    minWidth: chip.minWidth,
    paddingHorizontal: chip.paddingHorizontal,
    paddingVertical: chip.paddingVertical,
    borderRadius: chip.borderRadius,
    borderWidth: chip.borderWidth,
    borderColor: chip.borderColor,
    backgroundColor: chip.backgroundColor,
    justifyContent: 'center',
  },
  label: {
    ...TYPOGRAPHY.chipLabel,
    marginBottom: chip.labelMarginBottom,
  },
  value: {
    ...TYPOGRAPHY.chipValue,
    paddingRight: SPACING.xs,
    color: COLORS.accent,
  },
});
