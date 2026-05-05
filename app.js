import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';

import { useScanAnimation } from './hooks/useScanAnimation';
import { useKScan } from './hooks/useKScan';
import { AnalysisCard } from './components/AnalysisCard';
import { PerceptionLayer } from './components/PerceptionLayer';
import { ScanButton } from './components/ScanButton';
import {
  BUTTONS,
  COLORS,
  LAYOUT,
  LOADING,
  RADIUS,
  SPACING,
  TOAST,
  TYPOGRAPHY,
  viewfinder,
} from './constants/theme';

const EMPTY_METADATA = {
  category: '',
  color: '',
  silhouette: '',
};

function ErrorToast({ message, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        if (onDismiss) onDismiss();
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss, opacity]);

  return (
    <Animated.View style={[styles.errorToast, { opacity }]}>
      <Text style={styles.errorToastText}>{message}</Text>
    </Animated.View>
  );
}

function ActionButton({ label, onPress, variant = 'primary', disabled = false }) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isTertiary = variant === 'tertiary';

  return (
    <TouchableOpacity
      style={[
        styles.actionButtonBase,
        isPrimary ? styles.primaryButton : null,
        isSecondary ? styles.secondaryButton : null,
        isTertiary ? styles.tertiaryButton : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.86}
    >
      <Text
        style={[
          styles.actionButtonText,
          isPrimary ? styles.primaryButtonText : null,
          isSecondary ? styles.secondaryButtonText : null,
          isTertiary ? styles.tertiaryButtonText : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ProcessingPanel() {
  return (
    <View style={styles.processingPanel}>
      <ActivityIndicator size={LOADING.indicatorSize} color={COLORS.accent} />
      <Text style={styles.processingText}>Analyzing your look</Text>
      <Text style={styles.processingCaption}>
        Refining silhouette, palette, and category into your styling read.
      </Text>
    </View>
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const {
    status,
    photo,
    analysis,
    error,
    nonFashionMessage,
    capturePhoto,
    runAnalysis,
    retake,
    dismissResult,
    retry,
  } = useKScan();

  // Brief HUD overlay that starts when analysis completes (result state) and
  // dismisses itself — independent of network timing. We do NOT show it during
  // 'processing' because that's when compression + network is still running.
  // The overlay fires once we have real metadata to display.
  const [perceiving, setPerceiving] = useState(false);
  const prevStatus = useRef(status);
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;

    // Show the perception HUD exactly once when processing succeeds to result
    if (prev === 'processing' && status === 'result') {
      setPerceiving(true);
      return;
    }
    // Clear on any reset path
    if (status === 'idle' || status === 'error' || status === 'non-fashion') {
      setPerceiving(false);
    }
  }, [status]);

  const scanAnim = useScanAnimation(status === 'processing');

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContent}>
          <Text style={styles.brandTitle}>K-SCAN</Text>
          <Text style={styles.infoText}>
            We need access to your camera to capture your look.
          </Text>
          <ActionButton label="Allow Camera" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.centerContent}>
          <Text style={styles.brandTitle}>K-SCAN</Text>
          <Text style={styles.infoText}>
            Camera access is currently disabled. Enable it in settings to continue.
          </Text>
          <ActionButton label="Grant Access" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  const renderViewfinder = (isProcessing = false) => (
    <View style={[styles.viewfinderOverlay, { pointerEvents: 'none' }]}>
      <View style={styles.viewfinderFrame}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
        {isProcessing && (
          <Animated.View
            style={[
              styles.scanningLine,
              {
                transform: [
                  {
                    translateY: scanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        -viewfinder.scanningLineOffset,
                        viewfinder.scanningLineOffset,
                      ],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
      </View>
    </View>
  );

  const renderCameraScreen = () => (
    <View style={styles.cameraScreen}>
      <SafeAreaView style={styles.launchBannerShell} pointerEvents="box-none">
        <View style={styles.launchBanner}>
          <Text style={styles.brandTitle}>K-SCAN</Text>
          <Text style={styles.launchBannerText}>Scan Ready</Text>
        </View>
      </SafeAreaView>

      <View style={styles.cameraStage}>
        <CameraView
          style={styles.camera}
          ref={cameraRef}
          facing="back"
          onCameraReady={() => setIsCameraReady(true)}
        />

        <View style={[styles.cameraOverlay, { pointerEvents: 'box-none' }]}>
          <SafeAreaView style={styles.topBar}>
            <Text style={styles.brandTitle}>K-SCAN</Text>
            <Text style={styles.caption}>Capture your silhouette</Text>
            <View testID="scan-home-signal" style={styles.scanSignalBadge}>
              <Text style={styles.scanSignalText}>Scan Ready</Text>
            </View>
          </SafeAreaView>

          {renderViewfinder(false)}

          <View style={styles.bottomBar}>
            {status === 'capturing' ? (
              <ActivityIndicator
                testID="capturing-indicator"
                size="small"
                color={COLORS.accent}
              />
            ) : (
              <View testID="scan-button">
                <ScanButton
                  onPress={() => capturePhoto(cameraRef)}
                  disabled={status !== 'idle' || !isCameraReady}
                  pulse={status === 'idle'}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      {status === 'error' && error && !photo && (
        <ErrorToast message={error} onDismiss={dismissResult} />
      )}
    </View>
  );

  const renderPreviewImage = () => {
    if (photo?.uri) {
      return <Image source={{ uri: photo.uri }} style={styles.preview} />;
    }

    return (
      <View style={styles.previewFallback}>
        {__DEV__ && (
          <Text style={styles.devWarning}>
            DEV: preview rendered without photo - check useKScan transitions
          </Text>
        )}
        <Text style={styles.infoText}>No captured image available.</Text>
      </View>
    );
  };

  const renderActionArea = () => {
    if (status === 'preview') {
      return (
        <View style={styles.actionsContainer}>
          <ActionButton label="Analyze Style" onPress={runAnalysis} />
          <ActionButton label="Retake" onPress={retake} variant="secondary" />
        </View>
      );
    }

    if (status === 'processing') {
      return (
        <View style={styles.actionsContainer}>
          <ProcessingPanel />
        </View>
      );
    }

    if (status === 'non-fashion') {
      return (
        <View style={styles.actionsContainer}>
          <View style={styles.nonFashionPanel}>
            <Text style={styles.nonFashionTitle}>Not a Fashion Item</Text>
            <Text style={styles.nonFashionBody}>
              {nonFashionMessage ||
                "K-Scan is designed for clothing, shoes, and accessories. Point the camera at a garment or outfit."}
            </Text>
          </View>
          <ActionButton label="Scan Again" onPress={dismissResult} />
        </View>
      );
    }

    if (status === 'error') {
      return (
        <View style={styles.actionsContainer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <ActionButton label="Try Again" onPress={retry} variant="secondary" />
          <ActionButton label="Retake Photo" onPress={retake} variant="tertiary" />
        </View>
      );
    }

    return <View style={styles.actionsContainer} />;
  };

  const renderPreviewScreen = () => (
    <SafeAreaView style={styles.previewScreen}>
      <View style={styles.previewHeader}>
        <Text style={styles.brandTitle}>K-SCAN</Text>
        <Text style={styles.subtitle}>Look Analyzer</Text>
      </View>

      <View style={styles.previewContainer}>
        {renderPreviewImage()}
        {status === 'processing' ? renderViewfinder(true) : null}
      </View>

      {renderActionArea()}
    </SafeAreaView>
  );

  const renderContent = () => {
    switch (status) {
      case 'idle':
      case 'capturing':
        return renderCameraScreen();

      case 'preview':
      case 'processing':
      case 'result':
      case 'non-fashion':
        return renderPreviewScreen();

      case 'error':
        return photo ? renderPreviewScreen() : renderCameraScreen();

      default:
        return renderCameraScreen();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderContent()}

      {status === 'result' && perceiving && (
        <PerceptionLayer
          metadata={analysis?.metadata ?? EMPTY_METADATA}
          onComplete={() => setPerceiving(false)}
        />
      )}

      {status === 'result' && !perceiving && (
        <AnalysisCard
          result={analysis?.result ?? ''}
          metadata={analysis?.metadata ?? EMPTY_METADATA}
          products={analysis?.products ?? []}
          onDismiss={dismissResult}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  brandTitle: {
    ...TYPOGRAPHY.brand,
  },
  subtitle: {
    ...TYPOGRAPHY.subtitle,
    marginTop: SPACING.xs,
  },
  caption: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.sm,
  },
  scanSignalBadge: {
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
  },
  scanSignalText: {
    ...TYPOGRAPHY.cta,
    color: COLORS.textInverse,
  },
  infoText: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  processingText: {
    ...TYPOGRAPHY.title,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  processingCaption: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  errorText: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.errorSoft,
    textAlign: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  devWarning: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  actionButtonBase: {
    minWidth: BUTTONS.minWidth,
    minHeight: BUTTONS.height,
    paddingHorizontal: BUTTONS.horizontalPadding,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  actionButtonText: {
    ...TYPOGRAPHY.cta,
  },
  primaryButton: {
    backgroundColor: BUTTONS.primaryBackground,
  },
  primaryButtonText: {
    color: BUTTONS.primaryText,
  },
  secondaryButton: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: BUTTONS.secondaryBorder,
  },
  secondaryButtonText: {
    color: BUTTONS.secondaryText,
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
  },
  tertiaryButtonText: {
    color: BUTTONS.tertiaryText,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  launchBannerShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: LAYOUT.safeTop,
  },
  launchBanner: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceStrong,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  launchBannerText: {
    ...TYPOGRAPHY.cta,
    color: COLORS.accent,
    marginTop: SPACING.sm,
  },
  camera: {
    flex: 1,
  },
  cameraStage: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: LAYOUT.safeTop,
  },
  viewfinderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderFrame: {
    width: viewfinder.width,
    aspectRatio: viewfinder.aspectRatio,
    position: 'relative',
    overflow: 'hidden',
  },
  scanningLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: viewfinder.scanningLineHeight,
    backgroundColor: viewfinder.scanningLineColor,
    borderRadius: viewfinder.scanningLineHeight / 2,
    shadowColor: viewfinder.frameGlow,
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  corner: {
    position: 'absolute',
    width: viewfinder.cornerArmLength,
    height: viewfinder.cornerArmLength,
    borderColor: COLORS.textPrimary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: viewfinder.cornerStroke,
    borderLeftWidth: viewfinder.cornerStroke,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: viewfinder.cornerStroke,
    borderRightWidth: viewfinder.cornerStroke,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: viewfinder.cornerStroke,
    borderLeftWidth: viewfinder.cornerStroke,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: viewfinder.cornerStroke,
    borderRightWidth: viewfinder.cornerStroke,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: LAYOUT.cameraFooterPaddingBottom,
    paddingTop: LAYOUT.cameraFooterPaddingTop,
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
  },
  previewScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  previewHeader: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: LAYOUT.previewHeight,
    resizeMode: 'cover',
    borderRadius: LAYOUT.previewRadius,
  },
  previewFallback: {
    width: '100%',
    height: LAYOUT.previewHeight,
    borderRadius: LAYOUT.previewRadius,
    backgroundColor: COLORS.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  actionsContainer: {
    minHeight: LAYOUT.actionsMinHeight,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: LAYOUT.screenPadding,
    justifyContent: 'flex-start',
    gap: SPACING.sm,
  },
  processingPanel: {
    minHeight: LAYOUT.actionsMinHeight - SPACING.lg,
    borderRadius: LOADING.panelRadius,
    backgroundColor: LOADING.panelBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: LOADING.panelPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonFashionPanel: {
    borderRadius: LOADING.panelRadius,
    backgroundColor: LOADING.panelBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: LOADING.panelPadding,
    gap: SPACING.sm,
  },
  nonFashionTitle: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  nonFashionBody: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorToast: {
    position: 'absolute',
    top: TOAST.top,
    left: LAYOUT.screenPadding,
    right: LAYOUT.screenPadding,
    backgroundColor: TOAST.backgroundColor,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: TOAST.borderRadius,
    paddingVertical: TOAST.paddingVertical,
    paddingHorizontal: TOAST.paddingHorizontal,
    alignItems: 'center',
  },
  errorToastText: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.errorSoft,
    textAlign: 'center',
  },
});
