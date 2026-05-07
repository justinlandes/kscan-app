import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AnalysisCard } from '../components/AnalysisCard';
import { useLibrary } from '../hooks/useLibrary';
import {
  COLORS,
  LAYOUT,
  LOADING,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../constants/theme';

// ── Layout constants ──────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP  = SPACING.sm;
const H_PAD     = LAYOUT.screenPadding;
const CARD_W    = Math.floor((SCREEN_W - H_PAD * 2 - CARD_GAP) / 2);
const THUMB_H   = CARD_W; // square thumbnail

// ── SavedScan interface ───────────────────────────────────────────────────────
interface ScanAttributes {
  category:          string;
  silhouette:        string;
  color_palette:     string;
  material_estimate: string | null;
  style_tags:        string[];
  confidence_score:  number | null;
}

interface SavedScan {
  id:           string;
  createdAt:    string;
  thumbnailUri: string | null;
  attributes:   ScanAttributes;
  result:       string;
  products:     object[];
  source:       'scan';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now  = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)   return `${diffDays} days ago`;
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  } catch {
    return '';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>Your Style Library is empty.</Text>
      <Text style={styles.emptyBody}>Scan your first look.</Text>
    </View>
  );
}

interface ScanCardProps {
  scan:     SavedScan;
  onPress:  (scan: SavedScan) => void;
  onDelete: (id: string) => void;
}

function ScanCard({ scan, onPress, onDelete }: ScanCardProps) {
  return (
    <TouchableOpacity
      testID="scan-card"
      style={[styles.card, { width: CARD_W }]}
      onPress={() => onPress(scan)}
      activeOpacity={0.8}
    >
      {scan.thumbnailUri ? (
        <Image
          source={{ uri: scan.thumbnailUri }}
          style={[styles.thumb, { width: CARD_W, height: THUMB_H }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder, { width: CARD_W, height: THUMB_H }]} />
      )}

      <View style={styles.cardInfo}>
        <Text style={styles.cardCategory} numberOfLines={1}>
          {scan.attributes.category || '—'}
        </Text>
        <Text style={styles.cardDate}>{formatDate(scan.createdAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(scan.id)}
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      >
        <Text style={styles.deleteBtnText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const router = useRouter();
  const { scans, loading, remove } = useLibrary();
  const [selectedScan, setSelectedScan] = useState<SavedScan | null>(null);

  const handleOpenScan = (scan: SavedScan) => setSelectedScan(scan);
  const handleCloseScan = () => setSelectedScan(null);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.brandTitle}>K-SCAN</Text>
          <Text style={styles.screenTitle}>STYLE LIBRARY</Text>
        </View>

        {/* Spacer mirrors backBtn width for visual centering */}
        <View style={styles.headerRight} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size={LOADING.indicatorSize} color={COLORS.accent} />
        </View>
      ) : (
        <FlatList<SavedScan>
          data={scans}
          numColumns={2}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ScanCard
              scan={item}
              onPress={handleOpenScan}
              onDelete={remove}
            />
          )}
          style={styles.list}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[
            styles.listContent,
            scans.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={<EmptyState />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Reopen saved scan — no backend call, no useKScan involvement */}
      {selectedScan && (
        <AnalysisCard
          result={selectedScan.result}
          metadata={{
            category:  selectedScan.attributes.category,
            color:     selectedScan.attributes.color_palette,
            silhouette: selectedScan.attributes.silhouette,
          }}
          products={selectedScan.products as any}
          onDismiss={handleCloseScan}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  backBtnText: {
    fontSize: 22,
    color: COLORS.textPrimary,
    lineHeight: 26,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  brandTitle: {
    ...TYPOGRAPHY.brand,
    fontSize: 16,
  },
  screenTitle: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
    color: COLORS.textTertiary,
  },
  headerRight: {
    width: 36, // mirrors backBtn for centering
  },
  // ── List ───────────────────────────────────────────────────────────────────
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: H_PAD,
    paddingTop: SPACING.xl,
    paddingBottom: 80,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  gridRow: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  // ── Scan card ──────────────────────────────────────────────────────────────
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgElevated,
    overflow: 'hidden',
  },
  thumb: {
    // width/height set inline from CARD_W
  },
  thumbPlaceholder: {
    backgroundColor: COLORS.surfaceSoft,
  },
  cardInfo: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: SPACING.xxs,
  },
  cardCategory: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 1.8,
    color: COLORS.textPrimary,
    textTransform: 'uppercase' as const,
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '400' as const,
    color: COLORS.textTertiary,
    letterSpacing: 0.4,
  },
  deleteBtn: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(6, 7, 10, 0.72)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
  // ── Empty state ────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: H_PAD,
    gap: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyBody: {
    ...TYPOGRAPHY.body,
    color: COLORS.textTertiary,
    textAlign: 'center',
    fontSize: 14,
  },
  // ── Loading ────────────────────────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
