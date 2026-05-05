import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, viewfinder } from '../constants/theme';

const { cornerArmLength, cornerStroke } = viewfinder;

interface ViewfinderProps {
  scanningLineAnim: Animated.Value;
  isProcessing: boolean;
}

export function Viewfinder({ scanningLineAnim, isProcessing }: ViewfinderProps) {
  const lineTranslateY = scanningLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, viewfinder.scanTravelDistance],
  });

  return (
    <View style={styles.overlay}>
      <View style={styles.frame}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
        {isProcessing && (
          <Animated.View
            style={[styles.scanningLine, { transform: [{ translateY: lineTranslateY }] }]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  frame: {
    width: viewfinder.width,
    aspectRatio: viewfinder.aspectRatio,
    position: 'relative',
    marginHorizontal: viewfinder.cornerInset,
  },
  corner: {
    position: 'absolute',
    width: cornerArmLength,
    height: cornerArmLength,
    borderColor: COLORS.textPrimary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: cornerStroke,
    borderLeftWidth: cornerStroke,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: cornerStroke,
    borderRightWidth: cornerStroke,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: cornerStroke,
    borderLeftWidth: cornerStroke,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: cornerStroke,
    borderRightWidth: cornerStroke,
  },
  scanningLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: viewfinder.scanningLineHeight,
    backgroundColor: viewfinder.scanningLineColor,
  },
});
