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
  id?: string;
  name?: string;
  retailer?: string;
  price?: string;
  imageUrl?: string | null;
  productUrl?: string | null;
}

interface ProductShelfProps {
  products: Product[];
}

const CARD_WIDTH = 128;

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
      <Text style={styles.label}>Shop the Look</Text>
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
                <View style={[styles.image, styles.imagePlaceholder]} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.name} numberOfLines={2}>
                  {p.name || 'Unknown Product'}
                </Text>
                <Text style={styles.retailer}>
                  {(p.retailer || 'Retailer unavailable').toUpperCase()}
                </Text>
                <Text style={styles.price}>{p.price || 'Price unavailable'}</Text>
              </View>
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
  label: {
    ...TYPOGRAPHY.categoryLabel,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  scrollContent: {
    gap: SPACING.sm,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    overflow: 'hidden',
  },
  cardNoLink: {
    opacity: 0.65,
  },
  image: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.bgElevated,
  },
  cardBody: {
    padding: SPACING.sm,
    gap: SPACING.xxs,
  },
  name: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  retailer: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 1.4,
    color: COLORS.textTertiary,
    textTransform: 'uppercase' as const,
  },
  price: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.accent,
  },
  linkError: {
    ...TYPOGRAPHY.caption,
    color: COLORS.errorSoft,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
