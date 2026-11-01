import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Network } from '@kashahara/shared';
import {
  calculateAirtimeFeeKobo,
  detectNetwork,
  isValidNigerianPhone,
  normalizeNigerianPhone,
} from '@kashahara/shared';
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
import { AmountPad } from '../../src/components/AmountPad';
import { Card } from '../../src/components/Card';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { PurchaseFlowSheets } from '../../src/components/PurchaseFlowSheets';
import { spacing } from '../../src/theme/tokens';

const presets = [10_000, 20_000, 50_000, 100_000, 200_000];
const MIN_KOBO = 5_000;
const MAX_KOBO = 5_000_000;

export default function AirtimeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { catalog } = useCatalog();

  const [network, setNetwork] = useState<Network>('MTN');
  const [phone, setPhone] = useState('');
  const [amountKobo, setAmountKobo] = useState(0);

  const flow = usePurchaseFlow({
    onPinRequired: () => router.push('/settings/pin'),
    onInsufficientFunds: () => router.push('/add-money'),
  });

  const phoneValid = isValidNigerianPhone(phone);
  const canBuy = phoneValid && amountKobo >= MIN_KOBO && amountKobo <= MAX_KOBO;
  const serviceFeeKobo =
    amountKobo > 0 ? calculateAirtimeFeeKobo(amountKobo, catalog.airtimeFee) : 0;
  const totalKobo = amountKobo + serviceFeeKobo;
  const feeLabel =
    catalog.airtimeFee.percent > 0
      ? `Service fee (${catalog.airtimeFee.percent}%)`
      : 'Service fee';
  const networkName =
    catalog.networks.find((item) => item.id === network)?.shortName ?? network;

  const onPhoneChange = (value: string) => {
    setPhone(value);
    flow.resetKey();
    const detected = detectNetwork(value);
    if (detected) setNetwork(detected);
  };

  const submit = () => {
    if (!canBuy) {
      toast.error(
        'Check your details',
        phoneValid ? 'Choose an amount to continue.' : 'Enter a valid Nigerian phone number.',
      );
      return;
    }
    if (!user?.hasTransactionPin) {
      toast.info('Set a transaction PIN', 'You need a PIN before making a purchase.');
      router.push('/settings/pin');
      return;
    }
    const recipient = normalizeNigerianPhone(phone);
    flow.start(
      (pin, key) =>
        purchasesApi.airtime(
          {
            network,
            phone: recipient,
            amountKobo,
            pin,
          },
          key,
        ),
      {
        summary: [
          { label: 'Airtime amount', value: formatKobo(amountKobo) },
          { label: feeLabel, value: formatKobo(serviceFeeKobo) },
          { label: 'Total debit', value: formatKobo(totalKobo), emphasis: true },
        ],
      },
    );
  };

  return (
    <Screen>
      <Header showBack title="Buy airtime" subtitle="Top up any Nigerian network" />
      <Card tone="alt" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.summaryCopy}>
            <AppText variant="caption" color="textMuted">
              Sending to
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {phoneValid ? normalizeNigerianPhone(phone) : 'Enter a phone number'}
            </AppText>
          </View>
          <View style={styles.networkPill}>
            <AppText variant="caption" color="primary">
              {networkName}
            </AppText>
          </View>
        </View>
      </Card>

      <NetworkPicker
        networks={catalog.networks}
        value={network}
        onChange={(next) => {
          setNetwork(next.id);
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
        hint={
          phoneValid
            ? `Detected ${networkName}. Number portability means the network is a hint, not a guarantee.`
            : 'We use the prefix to suggest a network. You can change it above.'
        }
      />

      <AmountPad
        valueKobo={amountKobo}
        onChange={(value) => {
          setAmountKobo(value);
          flow.resetKey();
        }}
        presets={presets}
        minKobo={MIN_KOBO}
        maxKobo={MAX_KOBO}
        helper={
          amountKobo > 0
            ? `${formatKobo(serviceFeeKobo)} service fee · ${formatKobo(totalKobo)} total`
            : `Minimum ${formatKobo(MIN_KOBO, { decimals: false })} · maximum ${formatKobo(
                MAX_KOBO,
                { decimals: false },
              )}`
        }
        submitLabel={amountKobo > 0 ? `Pay ${formatKobo(totalKobo)}` : 'Continue'}
        onSubmit={submit}
        disabled={!phoneValid}
      />

      {!user?.hasTransactionPin ? (
        <Card tone="primary" style={styles.pinNudge}>
          <Ionicons name="keypad-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color="textSecondary" style={styles.pinText}>
            Set a transaction PIN before your first purchase.
          </AppText>
          <Button
            label="Set PIN"
            size="sm"
            fullWidth={false}
            onPress={() => router.push('/settings/pin')}
          />
        </Card>
      ) : null}

      <PurchaseFlowSheets flow={flow} onForgotPin={() => router.push('/settings/pin')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    paddingVertical: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
    gap: 1,
  },
  networkPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pinNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pinText: {
    flex: 1,
  },
});
