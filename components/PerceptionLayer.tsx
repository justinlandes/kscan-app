import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

const SNAP = 90;
const STAGGER = 80;
const HOLD = 300;
const FADE_OUT = 180;

const LABEL_COLOR = '#607070';
const VALUE_COLOR = '#8ECECE';

interface Metadata {
  category?: string;
  color?: string;
  silhouette?: string;
}

interface PerceptionLayerProps {
  metadata?: Metadata;
  onComplete: () => void;
}

function displayValue(value: string | undefined, fallback: string) {
  return value?.trim() ? value.trim().toUpperCase() : fallback;
}

export function PerceptionLayer({ metadata, onComplete }: PerceptionLayerProps) {
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const line1Opacity = useRef(new Animated.Value(0)).current;
  const line2Opacity = useRef(new Animated.Value(0)).current;
  const line3Opacity = useRef(new Animated.Value(0)).current;
  const lineAnims = [line1Opacity, line2Opacity, line3Opacity];

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.stagger(STAGGER, [
        Animated.timing(line1Opacity, { toValue: 1, duration: SNAP, useNativeDriver: true }),
        Animated.timing(line2Opacity, { toValue: 1, duration: SNAP, useNativeDriver: true }),
        Animated.timing(line3Opacity, { toValue: 1, duration: SNAP, useNativeDriver: true }),
      ]),
      Animated.delay(HOLD),
      Animated.timing(overlayOpacity, { toValue: 0, duration: FADE_OUT, useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onComplete();
    });

    return () => animation.stop();
  }, [line1Opacity, line2Opacity, line3Opacity, onComplete, overlayOpacity]);

  const lines = [
    { label: 'SILHOUETTE', value: displayValue(metadata?.silhouette, 'READING') },
    { label: 'STYLE', value: displayValue(metadata?.category, 'MAPPING') },
    { label: 'COLOR', value: displayValue(metadata?.color, 'SAMPLING') },
  ];

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      pointerEvents="none"
    >
      <View style={styles.block}>
        {lines.map(({ label, value }, i) => (
          <Animated.View key={label} style={[styles.row, { opacity: lineAnims[i] }]}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.sep}>{'  '}</Text>
            <Text style={styles.value}>{value}</Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(4, 6, 10, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  block: {
    gap: 14,
    paddingHorizontal: 32,
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  label: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 2.4,
    color: LABEL_COLOR,
  },
  sep: {
    fontFamily: MONO,
    fontSize: 11,
    color: LABEL_COLOR,
  },
  value: {
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 2,
    color: VALUE_COLOR,
  },
});
