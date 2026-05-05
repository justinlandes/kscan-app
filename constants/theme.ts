export const COLORS = {
  bg: '#06070A',
  bgElevated: '#0C0F15',
  surface: 'rgba(12, 15, 21, 0.88)',
  surfaceStrong: 'rgba(16, 21, 29, 0.94)',
  surfaceSoft: 'rgba(255, 255, 255, 0.08)',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#F8F7F4',
  textSecondary: '#C7C3BC',
  textTertiary: '#8A847A',
  textInverse: '#090B10',
  accent: '#F1E5C9',
  accentSoft: 'rgba(241, 229, 201, 0.18)',
  accentGlow: 'rgba(241, 229, 201, 0.28)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  chipBorder: 'rgba(255, 255, 255, 0.14)',
  cardBg: 'rgba(10, 13, 19, 0.70)',
  cardBorder: 'rgba(255, 255, 255, 0.16)',
  backdrop: 'rgba(3, 5, 9, 0.72)',
  overlay: 'rgba(0, 0, 0, 0.30)',
  error: '#FF655B',
  errorSoft: '#FFC3BC',
  success: '#D9F6D2',
  warning: '#F6DE8D',
};

export const colors = COLORS;

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  pill: 999,
};

export const TYPOGRAPHY = {
  brand: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: 4,
    color: COLORS.textPrimary,
    textTransform: 'uppercase' as const,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 2.6,
    color: COLORS.textTertiary,
    textTransform: 'uppercase' as const,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 2.6,
    color: COLORS.textTertiary,
  },
  headline: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: COLORS.textPrimary,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 2.2,
    color: COLORS.textSecondary,
    textTransform: 'uppercase' as const,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  bodyStrong: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 1.8,
    color: COLORS.textTertiary,
    textTransform: 'uppercase' as const,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: COLORS.textTertiary,
    letterSpacing: 2.2,
    textTransform: 'uppercase' as const,
  },
  chipValue: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.accent,
    lineHeight: 18,
  },
  cta: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 2.2,
    textTransform: 'uppercase' as const,
  },
};

export const chip = {
  minHeight: 56,
  minWidth: 104,
  paddingHorizontal: SPACING.lg,
  paddingVertical: SPACING.sm,
  borderRadius: RADIUS.pill,
  borderWidth: 1,
  borderColor: COLORS.chipBorder,
  backgroundColor: COLORS.surfaceSoft,
  labelMarginBottom: SPACING.xs,
};

export const card = {
  borderRadius: RADIUS.xl,
  paddingHorizontal: SPACING.xl,
  paddingVertical: SPACING.xl,
  blurIntensity: 72,
  borderWidth: 1,
  gripWidth: 48,
  gripHeight: 4,
  ctaMinHeight: 52,
  shadowColor: COLORS.black,
  shadowOpacity: 0.28,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
};

export const MOTION = {
  enterDuration: 520,
  exitDuration: 280,
  microDuration: 220,
  chipStagger: 90,
  pulseDuration: 1200,
  easing: { x1: 0.2, y1: 0.9, x2: 0.2, y2: 1.0 },
};

export const viewfinder = {
  width: '72%' as const,
  aspectRatio: 3 / 4,
  cornerArmLength: 34,
  cornerStroke: 2,
  cornerInset: SPACING.xxl,
  scanningLineHeight: 2,
  scanningLineOffset: 90,
  scanTravelDistance: 280,
  scanningLineColor: COLORS.accent,
  frameGlow: COLORS.accentGlow,
};

export const BUTTONS = {
  minWidth: 196,
  height: 52,
  horizontalPadding: SPACING.xl,
  primaryBackground: COLORS.accent,
  primaryText: COLORS.textInverse,
  secondaryBorder: COLORS.borderStrong,
  secondaryText: COLORS.textSecondary,
  tertiaryText: COLORS.textTertiary,
};

export const LAYOUT = {
  screenPadding: SPACING.xl,
  safeTop: SPACING.md,
  previewHeight: 400,
  previewRadius: RADIUS.xl,
  actionsMinHeight: 156,
  cameraFooterPaddingBottom: SPACING.xxl,
  cameraFooterPaddingTop: SPACING.lg,
  modalBottomPadding: SPACING.xxxl,
};

export const TOAST = {
  top: 100,
  borderRadius: RADIUS.md,
  paddingHorizontal: 20,
  paddingVertical: SPACING.lg,
  backgroundColor: 'rgba(9, 12, 18, 0.92)',
};

export const LOADING = {
  indicatorSize: 'large' as const,
  panelRadius: RADIUS.lg,
  panelPadding: SPACING.lg,
  panelBackground: COLORS.surfaceSoft,
};

export const CAPTURE_BUTTON = {
  touchSize: 84,
  outerSize: 80,
  innerSize: 62,
  borderWidth: 2,
};

export const api = {
  retryPorts: [8081, 8082],
  healthTimeoutMs: 1200,
  timeoutMs: 8000,
};
