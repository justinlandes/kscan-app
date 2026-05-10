import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Animated,
  type ImageStyle,
} from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { selectionTick } from '../services/haptics';

export interface Product {
  id?:         string;
  name?:       string;
  retailer?:   string;
  price?:      string;
  imageUrl?:   string | null;
  imageCategory?: string | null;
  productUrl?: string | null;
  purchaseUrl?: string | null;
  affiliateUrl?: string | null;
}

interface ProductShelfProps {
  products: Product[];
}

const CARD_WIDTH  = 144;
const IMAGE_SIZE  = CARD_WIDTH;
const PLACEHOLDER_CATEGORIES = new Set([
  'footwear',
  'outerwear',
  'tops',
  'bottoms',
  'dresses',
  'accessories',
]);

function normalizeImageCategory(category: string | null | undefined) {
  const normalized = String(category || '').toLowerCase().trim();
  return PLACEHOLDER_CATEGORIES.has(normalized) ? normalized : 'accessories';
}

function ProductImagePlaceholder({ category }: { category: string }) {
  if (category === 'footwear') {
    return (
      <View style={styles.placeholderMark}>
        <View style={[styles.footwearUpper, styles.placeholderStroke]} />
        <View style={[styles.footwearSole, styles.placeholderGoldStroke]} />
        <View style={[styles.footwearHeel, styles.placeholderCyanFill]} />
      </View>
    );
  }

  if (category === 'outerwear') {
    return (
      <View style={styles.placeholderMark}>
        <View style={[styles.outerwearBody, styles.placeholderStroke]} />
        <View style={[styles.outerwearLapels, styles.placeholderGoldStroke]} />
        <View style={[styles.outerwearSleeveLeft, styles.placeholderCyanStroke]} />
        <View style={[styles.outerwearSleeveRight, styles.placeholderCyanStroke]} />
      </View>
    );
  }

  if (category === 'tops') {
    return (
      <View style={styles.placeholderMark}>
        <View style={[styles.topsBody, styles.placeholderStroke]} />
        <View style={[styles.topsCollar, styles.placeholderGoldStroke]} />
        <View style={[styles.topsSleeveLeft, styles.placeholderCyanStroke]} />
        <View style={[styles.topsSleeveRight, styles.placeholderCyanStroke]} />
      </View>
    );
  }

  if (category === 'bottoms') {
    return (
      <View style={styles.placeholderMark}>
        <View style={[styles.bottomsWaist, styles.placeholderGoldStroke]} />
        <View style={[styles.bottomsLegLeft, styles.placeholderStroke]} />
        <View style={[styles.bottomsLegRight, styles.placeholderStroke]} />
      </View>
    );
  }

  if (category === 'dresses') {
    return (
      <View style={styles.placeholderMark}>
        <View style={[styles.dressBodice, styles.placeholderGoldStroke]} />
        <View style={[styles.dressSkirt, styles.placeholderStroke]} />
        <View style={[styles.dressHem, styles.placeholderCyanStroke]} />
      </View>
    );
  }

  return (
    <View style={styles.placeholderMark}>
      <View style={[styles.accessoryBody, styles.placeholderStroke]} />
      <View style={[styles.accessoryHandle, styles.placeholderGoldStroke]} />
      <View style={[styles.accessoryClasp, styles.placeholderCyanFill]} />
    </View>
  );
}

function CatalogProductImage({
  uri,
  productKey,
  imageCategory,
  onError,
}: {
  uri: string;
  productKey: string;
  imageCategory: string;
  onError: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.image}>
      <View style={[styles.image, styles.imageSkeleton]} />
      <Animated.Image
        source={{ uri }}
        style={[styles.productImage as ImageStyle, { opacity }]}
        resizeMode="cover"
        onLoad={() => {
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }).start();
        }}
        onError={() => {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log(
              '[K-SCAN ProductShelf] image load failed',
              JSON.stringify({
                productKey,
                category: imageCategory,
              }),
            );
          }
          onError();
        }}
      />
    </View>
  );
}

export function ProductShelf({ products }: ProductShelfProps) {
  const [linkErrorVisible, setLinkErrorVisible] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  if (!products || products.length === 0) return null;

  const handleLinkPress = (url: string | null | undefined) => {
    if (!url) return;
    selectionTick();
    Linking.openURL(url).catch(() => {
      setLinkErrorVisible(true);
      setTimeout(() => setLinkErrorVisible(false), 2000);
    });
  };

  return (
    <View testID="product-shelf" style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>CATALOG MATCHES</Text>
        <View style={styles.labelLine} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {products.map((p, i) => {
          const purchaseUrl = p.affiliateUrl || p.productUrl || p.purchaseUrl || null;
          const hasLink = !!purchaseUrl;
          const productKey = p.id ?? String(i);
          const imageCategory = normalizeImageCategory(p.imageCategory);
          const showImage = !!p.imageUrl && !failedImages[productKey];
          if (typeof __DEV__ !== 'undefined' && __DEV__ && !showImage) {
            console.log(
              '[K-SCAN ProductShelf] fallback',
              JSON.stringify({
                name: p.name || 'Unknown Product',
                hasImageUrl: !!p.imageUrl,
                category: imageCategory,
              }),
            );
          }
          return (
            <TouchableOpacity
              key={productKey}
              style={[styles.card, !hasLink && styles.cardNoLink]}
              onPress={() => handleLinkPress(purchaseUrl)}
              activeOpacity={hasLink ? 0.78 : 1}
            >
              {showImage ? (
                <CatalogProductImage
                  uri={p.imageUrl}
                  productKey={productKey}
                  imageCategory={imageCategory}
                  onError={() => setFailedImages((current) => ({ ...current, [productKey]: true }))}
                />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <ProductImagePlaceholder category={imageCategory} />
                </View>
              )}

              <View style={styles.cardBody}>
                {p.retailer ? (
                  <Text style={styles.retailer} numberOfLines={1}>
                    {p.retailer.toUpperCase()}
                  </Text>
                ) : null}
                <Text style={styles.name} numberOfLines={2}>
                  {p.name || 'Unknown Product'}
                </Text>
                <Text style={styles.price}>{p.price || '—'}</Text>
              </View>

              {hasLink && <View style={styles.linkDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {linkErrorVisible && (
        <Text style={styles.linkError}>LINK UNAVAILABLE</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.xl,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
    marginBottom:  SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.sectionLabel,
    color: COLORS.textTertiary,
  },
  labelLine: {
    flex:            1,
    height:          1,
    backgroundColor: COLORS.border,
    opacity:         0.5,
  },
  scrollContent: {
    gap:            SPACING.md,
    paddingBottom:  SPACING.xs,
  },
  card: {
    width:           CARD_WIDTH,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.surface,
    overflow:        'hidden',
  },
  cardNoLink: {
    opacity: 0.6,
  },
  image: {
    width:  IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  productImage: {
    width:  IMAGE_SIZE,
    height: IMAGE_SIZE,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  imageSkeleton: {
    backgroundColor: COLORS.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  placeholderMark: {
    width:          72,
    height:         72,
    alignItems:     'center',
    justifyContent: 'center',
  },
  placeholderStroke: {
    borderWidth:     1,
    borderColor:     COLORS.arPurple,
  },
  placeholderGoldStroke: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  placeholderCyanStroke: {
    borderWidth: 1,
    borderColor: COLORS.arBlue,
  },
  placeholderCyanFill: {
    backgroundColor: COLORS.arBlue,
  },
  footwearUpper: {
    position:     'absolute',
    left:         11,
    top:          31,
    width:        41,
    height:       18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 7,
    borderBottomWidth: 0,
  },
  footwearSole: {
    position:     'absolute',
    left:         8,
    top:          48,
    width:        55,
    height:       7,
    borderRadius: 7,
  },
  footwearHeel: {
    position: 'absolute',
    left:     13,
    top:      43,
    width:    7,
    height:   7,
  },
  outerwearBody: {
    position: 'absolute',
    top:      16,
    width:    34,
    height:   46,
    borderRadius: 5,
  },
  outerwearLapels: {
    position: 'absolute',
    top:      16,
    width:    16,
    height:   26,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  outerwearSleeveLeft: {
    position: 'absolute',
    left:     10,
    top:      22,
    width:    12,
    height:   34,
    borderRadius: 6,
  },
  outerwearSleeveRight: {
    position: 'absolute',
    right:    10,
    top:      22,
    width:    12,
    height:   34,
    borderRadius: 6,
  },
  topsBody: {
    position: 'absolute',
    top:      22,
    width:    36,
    height:   36,
    borderRadius: 6,
  },
  topsCollar: {
    position: 'absolute',
    top:      17,
    width:    18,
    height:   12,
    borderBottomWidth: 0,
    borderRadius: 9,
  },
  topsSleeveLeft: {
    position: 'absolute',
    left:     8,
    top:      25,
    width:    16,
    height:   16,
    borderRadius: 5,
  },
  topsSleeveRight: {
    position: 'absolute',
    right:    8,
    top:      25,
    width:    16,
    height:   16,
    borderRadius: 5,
  },
  bottomsWaist: {
    position: 'absolute',
    top:      16,
    width:    36,
    height:   8,
    borderRadius: 4,
  },
  bottomsLegLeft: {
    position: 'absolute',
    left:     19,
    top:      24,
    width:    15,
    height:   40,
    borderRadius: 4,
  },
  bottomsLegRight: {
    position: 'absolute',
    right:    19,
    top:      24,
    width:    15,
    height:   40,
    borderRadius: 4,
  },
  dressBodice: {
    position: 'absolute',
    top:      13,
    width:    20,
    height:   20,
    borderRadius: 5,
  },
  dressSkirt: {
    position: 'absolute',
    top:      31,
    width:    46,
    height:   32,
    borderTopWidth: 0,
    borderRadius: 6,
    transform: [{ perspective: 80 }, { rotateX: '14deg' }],
  },
  dressHem: {
    position: 'absolute',
    top:      60,
    width:    46,
    height:   1,
  },
  accessoryBody: {
    position: 'absolute',
    top:      28,
    width:    42,
    height:   31,
    borderRadius: 6,
  },
  accessoryHandle: {
    position: 'absolute',
    top:      16,
    width:    24,
    height:   22,
    borderBottomWidth: 0,
    borderRadius: 12,
  },
  accessoryClasp: {
    position: 'absolute',
    top:      39,
    width:    5,
    height:   5,
    borderRadius: 3,
  },
  cardBody: {
    padding: SPACING.sm,
    gap:     SPACING.xxs,
  },
  retailer: {
    fontSize:      9,
    fontWeight:    '600' as const,
    letterSpacing: 1.8,
    color:         COLORS.textTertiary,
    textTransform: 'uppercase' as const,
  },
  name: {
    fontSize:   12,
    fontWeight: '500' as const,
    color:      COLORS.textPrimary,
    lineHeight: 17,
  },
  price: {
    fontSize:   13,
    fontWeight: '600' as const,
    color:      COLORS.accent,
    marginTop:  SPACING.xxs,
  },
  linkDot: {
    position:        'absolute',
    top:             SPACING.xs,
    right:           SPACING.xs,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: COLORS.accent,
    opacity:         0.7,
  },
  linkError: {
    ...TYPOGRAPHY.caption,
    color:     COLORS.errorSoft,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
