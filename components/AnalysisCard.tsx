import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MetadataChip } from './MetadataChip';
import { ProductShelf, type Product } from './ProductShelf';
import {
  COLORS,
  LAYOUT,
  MOTION,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  card,
} from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FROM_Y = SCREEN_HEIGHT * 0.36;
const EMPTY_VALUE = '\u2014';

export interface AnalysisCardProps {
  result: string;
  metadata: { category: string; color: string; silhouette: string };
  products?: Product[];
  onDismiss: () => void;
}

function sanitizeText(value?: string) {
  return value?.trim() || EMPTY_VALUE;
}

export function AnalysisCard({ result, metadata, products = [], onDismiss }: AnalysisCardProps) {
  const translateY = useRef(new Animated.Value(FROM_Y)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const chip1Opacity = useRef(new Animated.Value(0)).current;
  const chip2Opacity = useRef(new Animated.Value(0)).current;
  const chip3Opacity = useRef(new Animated.Value(0)).current;
  const isExiting = useRef(false);

  const runExit = () => {
    if (isExiting.current) return;
    isExiting.current = true;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: FROM_Y,
        duration: MOTION.exitDuration,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: MOTION.exitDuration,
        useNativeDriver: true,
      }),
    ]).start(onDismiss);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > SPACING.md,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.vy > 0.3 || gesture.dy > 80) runExit();
      },
    })
  ).current;

  useEffect(() => {
    translateY.setValue(FROM_Y);
    opacity.setValue(0);
    chip1Opacity.setValue(0);
    chip2Opacity.setValue(0);
    chip3Opacity.setValue(0);
    isExiting.current = false;

    const easingFn = Easing.bezier(
      MOTION.easing.x1,
      MOTION.easing.y1,
      MOTION.easing.x2,
      MOTION.easing.y2
    );

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: MOTION.enterDuration,
        easing: easingFn,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: MOTION.enterDuration,
        easing: easingFn,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.stagger(MOTION.chipStagger, [
        Animated.timing(chip1Opacity, {
          toValue: 1,
          duration: MOTION.microDuration,
          useNativeDriver: true,
        }),
        Animated.timing(chip2Opacity, {
          toValue: 1,
          duration: MOTION.microDuration,
          useNativeDriver: true,
        }),
        Animated.timing(chip3Opacity, {
          toValue: 1,
          duration: MOTION.microDuration,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [translateY, opacity, chip1Opacity, chip2Opacity, chip3Opacity]);

  const meta = metadata ?? { category: '', color: '', silhouette: '' };
  const resultText = sanitizeText(result);
  const category = sanitizeText(meta.category);
  const color = sanitizeText(meta.color);
  const silhouette = sanitizeText(meta.silhouette);

  return (
    <Modal transparent animationType="none" onRequestClose={runExit}>
      <View style={styles.backdrop} pointerEvents="box-none">
        <Animated.View
          testID="analysis-card"
          style={[styles.cardWrap, { transform: [{ translateY }], opacity }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.glow} pointerEvents="none" />
          <View style={[styles.blur, { backgroundColor: 'rgba(10,13,19,0.95)' }]}>
            <View style={styles.cardInner}>
              <View style={styles.grip} />
              <Text style={styles.categoryLabel}>Style Analysis</Text>
              <Text style={styles.headline}>{meta.category && meta.category !== EMPTY_VALUE ? meta.category : 'Style Read'}</Text>
              <Text style={styles.body}>{resultText}</Text>

              <View style={styles.chipRow}>
                <Animated.View style={{ opacity: chip1Opacity }}>
                  <MetadataChip label="Category" value={category} />
                </Animated.View>
                <Animated.View style={{ opacity: chip2Opacity }}>
                  <MetadataChip label="Color" value={color} />
                </Animated.View>
                <Animated.View style={{ opacity: chip3Opacity }}>
                  <MetadataChip label="Silhouette" value={silhouette} />
                </Animated.View>
              </View>

              {products.length > 0
                ? <ProductShelf products={products} />
                : <Text style={styles.noMatchNote}>No catalog matches found.</Text>
              }

              <TouchableOpacity style={styles.cta} onPress={runExit} activeOpacity={0.86}>
                <Text style={styles.ctaText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.xl,
    paddingBottom: LAYOUT.modalBottomPadding,
  },
  cardWrap: {
    borderRadius: card.borderRadius,
    overflow: 'visible',
    shadowColor: card.shadowColor,
    shadowOpacity: card.shadowOpacity,
    shadowRadius: card.shadowRadius,
    shadowOffset: card.shadowOffset,
    elevation: 10,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    top: SPACING.lg,
    bottom: SPACING.lg,
    left: SPACING.xl,
    right: SPACING.xl,
    borderRadius: card.borderRadius,
    backgroundColor: COLORS.accentGlow,
    opacity: 0.22,
  },
  blur: {
    borderRadius: card.borderRadius,
    borderWidth: card.borderWidth,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    backgroundColor: COLORS.cardBg,
  },
  cardInner: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: card.paddingHorizontal,
    paddingVertical: card.paddingVertical,
  },
  grip: {
    alignSelf: 'center',
    width: card.gripWidth,
    height: card.gripHeight,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.borderStrong,
    marginBottom: SPACING.lg,
  },
  categoryLabel: {
    ...TYPOGRAPHY.categoryLabel,
    textTransform: 'uppercase',
  },
  headline: {
    ...TYPOGRAPHY.headline,
    marginTop: SPACING.sm,
  },
  body: {
    ...TYPOGRAPHY.body,
    marginTop: SPACING.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
  noMatchNote: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: COLORS.textTertiary,
    textAlign: 'center' as const,
    marginTop: SPACING.xl,
    letterSpacing: 0.4,
  },
  cta: {
    width: '100%',
    minHeight: card.ctaMinHeight,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  ctaText: {
    ...TYPOGRAPHY.cta,
    color: COLORS.textInverse,
  },
});
