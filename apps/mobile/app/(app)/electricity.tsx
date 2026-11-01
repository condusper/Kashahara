import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MeterType } from '@kashahara/shared';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { useCatalog } from '../../src/hooks/useCatalog';
import { usePurchaseFlow } from '../../src/hooks/usePurchaseFlow';
import {
  errorMessage,
  purchasesApi,
  type MeterVerificationResponse,
} from '../../src/lib/api';
import { formatKobo } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { AmountPad } from '../../src/components/AmountPad';
import { AppText } from '../../src/components/Text';
import { OptionSheet } from '../../src/components/OptionSheet';
import { PurchaseFlowSheets } from '../../src/components/PurchaseFlowSheets';
import { spacing } from '../../src/theme/tokens';

const presets = [100_000, 200_000, 500_000, 1_000_000, 2_000_000];
const MIN_KOBO = 50_000;
const MAX_KOBO = 50_000_000;

export default function ElectricityScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { catalog } = useCatalog();

  const [billerId, setBillerId] = useState<string | null>(null);
  const [meterType, setMeterType] = useState<MeterType>('prepaid');
  const [meterNumber, setMeterNumber] = useState('');
  const [verification, setVerification] = useState<MeterVerificationResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [amountKobo, setAmountKobo] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);

  const flow = usePurchaseFlow({
    onPinRequired: () => router.push('/settings/pin'),
    onInsufficientFunds: () => router.push('/add-money'),
  });

  const biller = catalog.electricityBillers.find((item) => item.id === billerId) ?? null;
  const meterValid = /^\d{6,20}$/.test(meterNumber.trim());

  const invalidate = () => {
    setVerification(null);
    flow.resetKey();
  };

  const verify = async () => {
    if (!billerId) {
      toast.error('Choose a provider', 'Select your electricity distribution company.');
      return;
    }
    if (!meterValid) {
      toast.error('Check the meter number', 'Enter a meter number with 6 to 20 digits.');
      return;
    }
    setVerifying(true);
    try {
      const result = await purchasesApi.verifyMeter({
        billerId,
        meterNumber: meterNumber.trim(),
        meterType,
      });
      setVerification(result.verification);
      toast.success('Meter verified', result.verification.customerName);
    } catch (verifyError) {
      setVerification(null);
      toast.error('Could not verify meter', errorMessage(verifyError));
    } finally {
      setVerifying(false);
    }
  };

  const submit = () => {
    if (!billerId || !verification) {
      toast.error('Verify your meter first', 'We need to confirm the meter before payment.');
      return;
    }
    if (amountKobo < MIN_KOBO || amountKobo > MAX_KOBO) {
      toast.error('Check the amount', `Enter between ${formatKobo(MIN_KOBO, { decimals: false })} and ${formatKobo(MAX_KOBO, { decimals: false })}.`);
      return;
    }
    if (!user?.hasTransactionPin) {
      toast.info('Set a transaction PIN', 'You need a PIN before making a purchase.');
      router.push('/settings/pin');
      return;
    }
    flow.start((pin, key) =>
      purchasesApi.electricity(
        {
          billerId,
          meterNumber: meterNumber.trim(),
          meterType,
          amountKobo,
          pin,
        },
        key,
      ),
    );
  };

  return (
    <Screen>
      <Header showBack title="Electricity" subtitle="Pay your meter, keep the lights on" />
      <Card style={styles.selectorCard}>
        <ListRow
          icon="business-outline"
          title={biller ? biller.name : 'Choose a distribution company'}
          subtitle={biller ? `${biller.shortName} · ${biller.state}` : 'Select where your meter is registered'}
          value={biller ? 'Change' : undefined}
          onPress={() => setPickerVisible(true)}
        />
      </Card>

      <SegmentedControl
        options={[
          { value: 'prepaid', label: 'Prepaid' },
          { value: 'postpaid', label: 'Postpaid' },
        ]}
        value={meterType}
        onChange={(value) => {
          setMeterType(value);
          invalidate();
        }}
        accessibilityLabel="Meter type"
      />

      <TextField
        label="Meter number"
        placeholder="e.g. 01234567890"
        value={meterNumber}
        onChangeText={(value) => {
          setMeterNumber(value);
          invalidate();
        }}
        keyboardType="number-pad"
        leftIcon="barcode-outline"
        error={meterNumber.length > 0 && !meterValid ? 'Enter 6 to 20 digits.' : null}
        hint="We verify the customer name before any money leaves your wallet."
      />

      <Button
        label={verification ? 'Meter verified' : 'Verify meter'}
        variant={verification ? 'secondary' : 'primary'}
        icon={verification ? 'checkmark-circle-outline' : 'search-outline'}
        onPress={verification ? undefined : verify}
        loading={verifying}
        disabled={!billerId || !meterValid || verifying}
      />

      {verification ? (
        <Card tone="primary" style={styles.verification}>
          <View style={styles.verificationHeader}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <AppText variant="bodyStrong">Meter verified</AppText>
          </View>
          <View style={styles.verificationRows}>
            <Row label="Customer" value={verification.customerName} />
            {verification.customerAddress ? (
              <Row label="Address" value={verification.customerAddress} />
            ) : null}
            <Row label="Meter" value={`${verification.meterNumber} · ${verification.meterType}`} />
            <Row label="Biller" value={biller?.name ?? verification.billerId} />
          </View>
        </Card>
      ) : (
        <Card tone="alt">
          <AppText variant="caption" color="textMuted">
            Verify the meter to see the customer name, then choose an amount. Verification is
            required so you never pay the wrong meter.
          </AppText>
        </Card>
      )}

      {verification ? (
        <AmountPad
          valueKobo={amountKobo}
          onChange={(value) => {
            setAmountKobo(value);
            flow.resetKey();
          }}
          presets={presets}
          minKobo={MIN_KOBO}
          maxKobo={MAX_KOBO}
          helper={`Minimum ${formatKobo(MIN_KOBO, { decimals: false })} · maximum ${formatKobo(
            MAX_KOBO,
            { decimals: false },
          )}`}
          submitLabel={amountKobo > 0 ? `Pay ${formatKobo(amountKobo)}` : 'Pay electricity'}
          onSubmit={submit}
        />
      ) : null}

      <OptionSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Choose a provider"
        description="Select the company that supplies your electricity."
        searchable
        searchPlaceholder="Search billers"
        selectedId={billerId}
        options={catalog.electricityBillers.map((item) => ({
          id: item.id,
          label: item.name,
          description: `${item.shortName} · ${item.state}`,
          meta: item.meterTypes.join(' / '),
        }))}
        onSelect={(option) => {
          setBillerId(option.id);
          invalidate();
        }}
      />

      <PurchaseFlowSheets flow={flow} onForgotPin={() => router.push('/settings/pin')} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color="textMuted" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant="caption" color="textSecondary" style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  selectorCard: {
    paddingVertical: 2,
    paddingHorizontal: spacing.md,
  },
  verification: {
    gap: spacing.sm,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  verificationRows: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowLabel: {
    width: 80,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
});
