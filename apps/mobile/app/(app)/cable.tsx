import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CablePackage } from '@kashahara/shared';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { useCatalog } from '../../src/hooks/useCatalog';
import { usePurchaseFlow } from '../../src/hooks/usePurchaseFlow';
import {
  errorMessage,
  purchasesApi,
  type CableVerificationResponse,
} from '../../src/lib/api';
import { formatKobo } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { AppText } from '../../src/components/Text';
import { OptionSheet } from '../../src/components/OptionSheet';
import { PurchaseFlowSheets } from '../../src/components/PurchaseFlowSheets';
import { radii, spacing } from '../../src/theme/tokens';

export default function CableScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { catalog } = useCatalog();

  const [providerId, setProviderId] = useState<string | null>(null);
  const [smartcardNumber, setSmartcardNumber] = useState('');
  const [verification, setVerification] = useState<CableVerificationResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const flow = usePurchaseFlow({
    onPinRequired: () => router.push('/settings/pin'),
    onInsufficientFunds: () => router.push('/add-money'),
  });

  const provider = catalog.cableProviders.find((item) => item.id === providerId) ?? null;
  const selectedPackage =
    provider?.packages.find((item) => item.id === packageId) ?? null;
  const cardValid = /^\d{6,20}$/.test(smartcardNumber.trim());

  const invalidate = () => {
    setVerification(null);
    setPackageId(null);
    flow.resetKey();
  };

  const verify = async () => {
    if (!providerId) {
      toast.error('Choose a provider', 'Select your cable or satellite provider.');
      return;
    }
    if (!cardValid) {
      toast.error('Check the smartcard number', 'Enter a smartcard number with 6 to 20 digits.');
      return;
    }
    setVerifying(true);
    try {
      const result = await purchasesApi.verifyCable({
        providerId,
        smartcardNumber: smartcardNumber.trim(),
      });
      setVerification(result.verification);
      toast.success('Smartcard verified', result.verification.customerName);
    } catch (verifyError) {
      setVerification(null);
      toast.error('Could not verify smartcard', errorMessage(verifyError));
    } finally {
      setVerifying(false);
    }
  };

  const submit = () => {
    if (!providerId || !verification || !selectedPackage) {
      toast.error('Choose a package', 'Verify the smartcard and select a package first.');
      return;
    }
    if (!user?.hasTransactionPin) {
      toast.info('Set a transaction PIN', 'You need a PIN before making a purchase.');
      router.push('/settings/pin');
      return;
    }
    flow.start((pin, key) =>
      purchasesApi.cable(
        {
          providerId,
          smartcardNumber: smartcardNumber.trim(),
          packageId: selectedPackage.id,
          pin,
        },
        key,
      ),
    );
  };

  return (
    <Screen>
      <Header showBack title="Cable TV" subtitle="Renew your TV subscription" />
      <Card style={styles.selectorCard}>
        <ListRow
          icon="tv-outline"
          title={provider ? provider.name : 'Choose a provider'}
          subtitle={provider ? 'Tap to change provider' : 'DStv, GOtv, StarTimes, or Showmax'}
          value={provider ? 'Change' : undefined}
          onPress={() => setPickerVisible(true)}
        />
      </Card>

      <TextField
        label="Smartcard or account number"
        placeholder="e.g. 0123456789"
        value={smartcardNumber}
        onChangeText={(value) => {
          setSmartcardNumber(value);
          invalidate();
        }}
        keyboardType="number-pad"
        leftIcon="card-outline"
        error={smartcardNumber.length > 0 && !cardValid ? 'Enter 6 to 20 digits.' : null}
      />

      <Button
        label={verification ? 'Smartcard verified' : 'Verify smartcard'}
        variant={verification ? 'secondary' : 'primary'}
        icon={verification ? 'checkmark-circle-outline' : 'search-outline'}
        onPress={verification ? undefined : verify}
        loading={verifying}
        disabled={!providerId || !cardValid || verifying}
      />

      {verification ? (
        <Card tone="primary" style={styles.verification}>
          <View style={styles.verificationHeader}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <AppText variant="bodyStrong">Smartcard verified</AppText>
          </View>
          <AppText variant="caption" color="textSecondary">
            {verification.customerName}
            {verification.currentPackage ? ` · ${verification.currentPackage}` : ''}
          </AppText>
          <AppText variant="caption" color="textMuted">
            Smartcard {verification.smartcardNumber}
          </AppText>
        </Card>
      ) : null}

      {verification && provider ? (
        <>
          <View style={styles.heading}>
            <AppText variant="h3">Choose a package</AppText>
            <AppText variant="caption" color="textMuted">
              {provider.packages.length} options
            </AppText>
          </View>
          <View style={styles.packages}>
            {provider.packages.map((item) => (
              <PackageRow
                key={item.id}
                item={item}
                selected={item.id === packageId}
                onPress={() => {
                  setPackageId(item.id);
                  flow.resetKey();
                }}
              />
            ))}
          </View>

          {selectedPackage ? (
            <Card tone="primary" style={styles.summary}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryCopy}>
                  <AppText variant="caption" color="textSecondary">
                    Renewing
                  </AppText>
                  <AppText variant="bodyStrong">{selectedPackage.name}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {selectedPackage.validity} · {verification.customerName}
                  </AppText>
                </View>
                <AppText variant="h2" color="primary">
                  {formatKobo(selectedPackage.priceKobo)}
                </AppText>
              </View>
              <Button
                label={`Pay ${formatKobo(selectedPackage.priceKobo)}`}
                onPress={submit}
              />
            </Card>
          ) : null}
        </>
      ) : (
        <Card tone="alt">
          <AppText variant="caption" color="textMuted">
            Verify the smartcard first. We only show packages after the customer name is
            confirmed.
          </AppText>
        </Card>
      )}

      <OptionSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Choose a provider"
        description="Select your television provider."
        selectedId={providerId}
        options={catalog.cableProviders.map((item) => ({
          id: item.id,
          label: item.name,
          description: `${item.packages.length} packages`,
        }))}
        onSelect={(option) => {
          setProviderId(option.id);
          invalidate();
        }}
      />

      <PurchaseFlowSheets flow={flow} onForgotPin={() => router.push('/settings/pin')} />
    </Screen>
  );
}

function PackageRow({
  item,
  selected,
  onPress,
}: {
  item: CablePackage;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.name}, ${item.validity}, ${formatKobo(item.priceKobo)}`}
      style={({ pressed }) => [
        styles.packageRow,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.packageCopy}>
        <AppText variant="callout">{item.name}</AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {item.description} · {item.validity}
        </AppText>
      </View>
      <AppText variant="bodyStrong">{formatKobo(item.priceKobo)}</AppText>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selectorCard: {
    paddingVertical: 2,
    paddingHorizontal: spacing.md,
  },
  verification: {
    gap: spacing.xs,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  packages: {
    gap: spacing.xs,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 60,
  },
  packageCopy: {
    flex: 1,
    gap: 2,
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
