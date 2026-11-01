import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { DataPlan, Network } from '@kashahara/shared';
import { detectNetwork, isValidNigerianPhone, normalizeNigerianPhone } from '@kashahara/shared';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { useCatalog } from '../../src/hooks/useCatalog';
import { usePurchaseFlow } from '../../src/hooks/usePurchaseFlow';
import { purchasesApi } from '../../src/lib/api';
import { formatKobo } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { NetworkPicker } from '../../src/components/NetworkPicker';
import { TextField } from '../../src/components/TextField';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { PurchaseFlowSheets } from '../../src/components/PurchaseFlowSheets';
import { EmptyState } from '../../src/components/EmptyState';
import { radii, spacing } from '../../src/theme/tokens';

export default function DataScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { catalog } = useCatalog();

  const [network, setNetwork] = useState<Network>('MTN');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);

  const flow = usePurchaseFlow({
    onPinRequired: () => router.push('/settings/pin'),
    onInsufficientFunds: () => router.push('/add-money'),
  });

  const plans = useMemo(
    () => catalog.dataPlans.filter((plan) => plan.network === network),
    [catalog.dataPlans, network],
  );
  const selected = plans.find((plan) => plan.id === planId) ?? null;
  const phoneValid = isValidNigerianPhone(phone);
  const canBuy = phoneValid && Boolean(selected);

  const onPhoneChange = (value: string) => {
    setPhone(value);
    flow.resetKey();
    const detected = detectNetwork(value);
    if (detected && detected !== network) {
      setNetwork(detected);
      setPlanId(null);
    }
  };

  const submit = () => {
    if (!selected) {
      toast.error('Choose a bundle', 'Select a data plan to continue.');
      return;
    }
    if (!phoneValid) {
      toast.error('Check the phone number', 'Enter a valid Nigerian phone number.');
      return;
    }
    if (!user?.hasTransactionPin) {
      toast.info('Set a transaction PIN', 'You need a PIN before making a purchase.');
      router.push('/settings/pin');
      return;
    }
    flow.start((pin, key) =>
      purchasesApi.data(
        {
          network,
          phone: normalizeNigerianPhone(phone),
          planId: selected.id,
          pin,
        },
        key,
      ),
    );
  };

  return (
    <Screen>
      <Header showBack title="Buy data" subtitle="Bundles for every network" />
      <NetworkPicker
        networks={catalog.networks}
        value={network}
        onChange={(next) => {
          setNetwork(next.id);
          setPlanId(null);
          flow.resetKey();
        }}
      />

      <TextField
        label="Phone number"
        placeholder="0803 000 0000"
        value={phone}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        leftIcon="call-outline"
        error={phone.length > 0 && !phoneValid ? 'Enter a valid Nigerian phone number.' : null}
      />

      <View style={styles.planHeading}>
        <AppText variant="h3">Choose a bundle</AppText>
        <AppText variant="caption" color="textMuted">
          {plans.length} bundles
        </AppText>
      </View>

      {plans.length === 0 ? (
        <Card>
          <EmptyState
            icon="wifi-outline"
            title="No bundles for this network"
            description="There are no bundles for this network right now. Try another network."
          />
        </Card>
      ) : (
        <View style={styles.plans}>
          {plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              selected={plan.id === planId}
              onPress={() => {
                setPlanId(plan.id);
                flow.resetKey();
              }}
            />
          ))}
        </View>
      )}

      {selected ? (
        <Card tone="primary" style={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryCopy}>
              <AppText variant="caption" color="textSecondary">
                You are buying
              </AppText>
              <AppText variant="bodyStrong">
                {selected.allowance} · {selected.validity}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {selected.name} for {normalizeNigerianPhone(phone)}
              </AppText>
            </View>
            <AppText variant="h2" color="primary">
              {formatKobo(selected.priceKobo)}
            </AppText>
          </View>
          <Button
            label={`Buy ${selected.allowance} for ${formatKobo(selected.priceKobo)}`}
            onPress={submit}
            disabled={!canBuy}
          />
        </Card>
      ) : null}

      <PurchaseFlowSheets flow={flow} onForgotPin={() => router.push('/settings/pin')} />
    </Screen>
  );
}

function PlanRow({
  plan,
  selected,
  onPress,
}: {
  plan: DataPlan;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.name}, ${plan.allowance}, ${plan.validity}, ${formatKobo(
        plan.priceKobo,
      )}`}
      style={({ pressed }) => [
        styles.plan,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.planLeft}>
        <View style={styles.planTitleRow}>
          <AppText variant="bodyStrong">{plan.allowance}</AppText>
          <Badge label={plan.category} tone={selected ? 'brand' : 'neutral'} compact />
        </View>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {plan.name} · {plan.validity}
        </AppText>
      </View>
      <View style={styles.planRight}>
        <AppText variant="bodyStrong">{formatKobo(plan.priceKobo)}</AppText>
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
  planHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  plans: {
    gap: spacing.xs,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 64,
  },
  planLeft: {
    flex: 1,
    gap: 2,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
});
