import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ExamProduct } from '@kashahara/shared';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { useCatalog } from '../../src/hooks/useCatalog';
import { usePurchaseFlow } from '../../src/hooks/usePurchaseFlow';
import { purchasesApi } from '../../src/lib/api';
import { formatKobo } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { PurchaseFlowSheets } from '../../src/components/PurchaseFlowSheets';
import { radii, spacing } from '../../src/theme/tokens';

export default function ExamScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { catalog } = useCatalog();

  const [productId, setProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const flow = usePurchaseFlow({
    onPinRequired: () => router.push('/settings/pin'),
    onInsufficientFunds: () => router.push('/add-money'),
  });

  const product = catalog.examProducts.find((item) => item.id === productId) ?? null;
  const totalKobo = product ? product.priceKobo * quantity : 0;

  const submit = () => {
    if (!product) {
      toast.error('Choose a product', 'Select the examination voucher you need.');
      return;
    }
    if (!user?.hasTransactionPin) {
      toast.info('Set a transaction PIN', 'You need a PIN before making a purchase.');
      router.push('/settings/pin');
      return;
    }
    flow.start((pin, key) =>
      purchasesApi.exam({ productId: product.id, quantity, pin }, key),
    );
  };

  return (
    <Screen>
      <Header showBack title="Exam PINs" subtitle="Result checkers and registration vouchers" />
      <Card tone="alt">
        <AppText variant="caption" color="textMuted">
          Vouchers are delivered instantly as a serial number and PIN. Save your receipt so
          you always have them within reach.
        </AppText>
      </Card>

      <View style={styles.heading}>
        <AppText variant="h3">Choose a voucher</AppText>
        <AppText variant="caption" color="textMuted">
          {catalog.examProducts.length} products
        </AppText>
      </View>

      <View style={styles.products}>
        {catalog.examProducts.map((item) => (
          <ProductRow
            key={item.id}
            item={item}
            selected={item.id === productId}
            onPress={() => {
              setProductId(item.id);
              flow.resetKey();
            }}
          />
        ))}
      </View>

      {product ? (
        <Card tone="primary" style={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryCopy}>
              <AppText variant="caption" color="textSecondary">
                {product.provider}
              </AppText>
              <AppText variant="bodyStrong">{product.name}</AppText>
              <AppText variant="caption" color="textMuted">
                {formatKobo(product.priceKobo)} each
              </AppText>
            </View>
            <AppText variant="h2" color="primary">
              {formatKobo(totalKobo)}
            </AppText>
          </View>

          <View style={styles.quantityRow}>
            <AppText variant="callout">Quantity</AppText>
            <View style={[styles.stepper, { borderColor: colors.borderStrong }]}>
              <Pressable
                onPress={() => {
                  setQuantity((value) => Math.max(1, value - 1));
                  flow.resetKey();
                }}
                disabled={quantity <= 1}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                style={({ pressed }) => [
                  styles.stepButton,
                  { opacity: quantity <= 1 ? 0.35 : pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="remove" size={18} color={colors.text} />
              </Pressable>
              <AppText variant="bodyStrong" style={styles.stepValue}>
                {quantity}
              </AppText>
              <Pressable
                onPress={() => {
                  setQuantity((value) => Math.min(5, value + 1));
                  flow.resetKey();
                }}
                disabled={quantity >= 5}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                style={({ pressed }) => [
                  styles.stepButton,
                  { opacity: quantity >= 5 ? 0.35 : pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <Button label={`Buy ${quantity} voucher${quantity > 1 ? 's' : ''}`} onPress={submit} />
        </Card>
      ) : null}

      <PurchaseFlowSheets flow={flow} onForgotPin={() => router.push('/settings/pin')} />
    </Screen>
  );
}

function ProductRow({
  item,
  selected,
  onPress,
}: {
  item: ExamProduct;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.name}, ${formatKobo(item.priceKobo)}`}
      style={({ pressed }) => [
        styles.product,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.productIcon, { backgroundColor: selected ? colors.surface : colors.surfaceAlt }]}>
        <Ionicons name="school-outline" size={18} color={selected ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.productCopy}>
        <View style={styles.productTitle}>
          <AppText variant="callout" numberOfLines={1} style={styles.productName}>
            {item.name}
          </AppText>
          <Badge
            label={item.provider}
            tone={selected ? 'brand' : 'neutral'}
            compact
            style={styles.productBadge}
          />
        </View>
        <AppText
          variant="caption"
          color="textMuted"
          numberOfLines={2}
          style={styles.productDescription}
        >
          {item.description}
        </AppText>
      </View>
      <View style={styles.productRight}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.productPrice}>
          {formatKobo(item.priceKobo)}
        </AppText>
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? colors.primary : colors.borderStrong,
              backgroundColor: selected ? colors.primary : 'transparent',
            },
          ]}
        >
          {selected ? <Ionicons name="checkmark" size={12} color={colors.onPrimary} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  products: {
    gap: spacing.xs,
  },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  productIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  productCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  productTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: spacing.xs,
  },
  productName: {
    flexShrink: 1,
    minWidth: 0,
  },
  productBadge: {
    alignSelf: 'center',
    flexShrink: 0,
  },
  productDescription: {
    minWidth: 0,
  },
  productRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  productPrice: {
    flexShrink: 0,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    gap: spacing.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  stepButton: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 28,
    textAlign: 'center',
  },
});
