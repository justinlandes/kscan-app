import React from 'react';
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
  id: string;
  name: string;
  retailer: string;
  price: string;
  imageUrl: string;
  productUrl: string;
}

interface ProductShelfProps {
  products: Product[];
}

const CARD_WIDTH = 128;

export function ProductShelf({ products }: ProductShelfProps) {
  if (!products || products.length === 0) return null;

  return (
    <View testID="product-shelf" style={styles.container}>
      <Text style={styles.label}>Shop the Look</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {products.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => Linking.openURL(p.productUrl).catch(() => null)}
            activeOpacity={0.78}
          >
            <Image
              source={{ uri: p.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.cardBody}>
              <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.retailer}>{p.retailer}</Text>
              <Text style={styles.price}>{p.price}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  image: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
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
});
