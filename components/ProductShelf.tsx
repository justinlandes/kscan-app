import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

export interface Product {
  id?:         string;
  name?:       string;
  retailer?:   string;
  price?:      string;
  imageUrl?:   string | null;
  productUrl?: string | null;
}

interface ProductShelfProps {
  products: Product[];
}

const CARD_WIDTH  = 144;
const IMAGE_SIZE  = CARD_WIDTH;

export function ProductShelf({ products }: ProductShelfProps) {
  const [linkErrorVisible, setLinkErrorVisible] = useState(false);

  if (!products || products.length === 0) return null;

  const handleLinkPress = (url: string | null | undefined) => {
    if (!url) return;
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
          const hasLink = !!p.productUrl;
          return (
            <TouchableOpacity
              key={p.id ?? String(i)}
              style={[styles.card, !hasLink && styles.cardNoLink]}
              onPress={() => handleLinkPress(p.productUrl)}
              activeOpacity={hasLink ? 0.78 : 1}
            >
              {p.imageUrl ? (
                <Image
                  source={{ uri: p.imageUrl }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <View style={styles.placeholderInner} />
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
  imagePlaceholder: {
    backgroundColor: COLORS.bg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  placeholderInner: {
    width:           32,
    height:          32,
    borderRadius:    4,
    borderWidth:     1,
    borderColor:     COLORS.border,
    opacity:         0.4,
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
