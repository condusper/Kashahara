import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { TRANSACTION_STATUS_EXPLANATIONS } from '@kashahara/shared';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useToast } from '../../../src/providers/ToastProvider';
import { useReceipt } from '../../../src/providers/ReceiptProvider';
import { useTransaction } from '../../../src/hooks/useTransaction';
import { errorMessage } from '../../../src/lib/api';
import {
  formatDateTime,
  formatKobo,
  serviceLabel,
  statusLabel,
  statusTone,
  transactionSubtitle,
  transactionTitle,
} from '../../../src/lib/format';
import { toneColors } from '../../../src/theme/tones';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';
import { AppText } from '../../../src/components/Text';
import { Button } from '../../../src/components/Button';
import { Skeleton } from '../../../src/components/Skeleton';
import { EmptyState } from '../../../src/components/EmptyState';
import { FadeUp, PopIn } from '../../../src/components/Motion';
import { radii, spacing } from '../../../src/theme/tokens';

const friendlyKeys: Record<string, string> = {
  network: 'Network',
  phone: 'Phone',
  planName: 'Plan',
  allowance: 'Allowance',
  validity: 'Validity',
  billerId: 'Biller',
  meterNumber: 'Meter number',
  meterType: 'Meter type',
  customerName: 'Customer',
  customerAddress: 'Address',
  providerName: 'Provider',
  packageName: 'Package',
  smartcardNumber: 'Smartcard',
  productName: 'Product',
  quantity: 'Quantity',
  unitPriceKobo: 'Unit price',
  units: 'Units',
};

const hiddenKeys = new Set([
  'token',
  'vouchers',
  'simulated',
  'providerMessage',
  'uncertain',
  'refunded',
  'verificationIsDemo',
  'faceValueKobo',
  'serviceFeeKobo',
]);

export default function TransactionDetailScreen() {
  const router = useRouter();
  const toast = useToast();
  const receipt = useReceipt();
  const { colors } = useTheme();
  const { user, setWallet } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { transaction, wallet, loading, refreshing, error, refresh, reload } = useTransaction(id);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (wallet) setWallet(wallet);
  }, [wallet, setWallet]);

  const copy = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy', 'Select the value and copy it manually.');
    }
  };

  const download = async () => {
    if (!transaction) return;
    setDownloading(true);
    try {
      const file = await receipt.downloadTransaction(transaction, {
        name: user?.fullName,
        email: user?.email,
        phone: user?.phone,
      });
      if (!file.shared) {
        toast.info('Receipt saved', 'Your receipt was saved on this device.');
      }
    } catch (downloadError) {
      toast.error('Could not create receipt', errorMessage(downloadError));
    } finally {
      setDownloading(false);
    }
  };

  const onRefresh = async () => {
    try {
      const result = await refresh();
      if (!result) return;
      if (result.transaction.status === 'successful') {
        toast.success('Status updated', 'The provider confirmed this order.');
      } else if (result.transaction.status === 'refunded') {
        toast.info('Refunded to wallet', 'The provider declined this order.');
      } else if (result.transaction.status === 'uncertain') {
        toast.info('Still uncertain', 'Please contact support before retrying.');
      } else {
        toast.info('Status refreshed', `Current status: ${statusLabel(result.transaction.status)}.`);
      }
    } catch (refreshError) {
      toast.error('Could not refresh', errorMessage(refreshError));
    }
  };

  if (loading) {
    return (
      <Screen>
        <Header showBack title="Receipt" />
        <Card style={styles.skeletonHero}>
          <Skeleton width={72} height={72} radius={36} />
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={30} />
        </Card>
        <Card style={styles.skeletonCard}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} width="100%" height={16} />
          ))}
        </Card>
      </Screen>
    );
  }

  if (!transaction) {
    return (
      <Screen>
        <Header showBack title="Receipt" />
        <Card>
          <EmptyState
            icon="receipt-outline"
            title="Transaction not found"
            description={error ?? 'This receipt may have been removed or belongs to another account.'}
            actionLabel="Try again"
            onAction={() => void reload()}
          />
        </Card>
      </Screen>
    );
  }

  const tone = statusTone(transaction.status);
  const palette = toneColors(colors, tone);
  const canRefresh = ['uncertain', 'processing', 'reversal_pending', 'created'].includes(
    transaction.status,
  );
  const token =
    typeof transaction.details.token === 'string' ? transaction.details.token : null;
  const vouchers = readVouchers(transaction.details.vouchers);
  const providerMessage =
    typeof transaction.details.providerMessage === 'string'
      ? transaction.details.providerMessage
      : null;
  const detailEntries = Object.entries(transaction.details).filter(
    ([key, value]) => !hiddenKeys.has(key) && typeof value !== 'object',
  );

  return (
    <Screen>
      <Header
        showBack
        eyebrow="Receipt"
        title="Transaction"
        subtitle={transaction.reference}
        right={
          <Pressable
            onPress={() => copy(transaction.reference, 'Reference')}
            accessibilityRole="button"
            accessibilityLabel="Copy transaction reference"
            hitSlop={8}
            style={styles.copyIcon}
          >
            <Ionicons name="copy-outline" size={19} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <FadeUp>
        <Card style={styles.hero}>
          <PopIn>
            <View style={[styles.iconWrap, { backgroundColor: palette.background }]}>
              <Ionicons
                name={
                  transaction.status === 'successful'
                    ? 'checkmark-circle'
                    : transaction.status === 'uncertain'
                      ? 'time'
                      : ['failed', 'refunded', 'reversed'].includes(transaction.status)
                        ? 'close-circle'
                        : 'receipt-outline'
                }
                size={36}
                color={palette.foreground}
              />
            </View>
          </PopIn>
          <AppText variant="h2" align="center">
            {transactionTitle(transaction)}
          </AppText>
          <View style={styles.amountRow}>
            <AppText variant="callout" color="textMuted" style={styles.amountCurrency}>
              ₦
            </AppText>
            <AppText
              variant="display"
              align="center"
              tabular
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={styles.amount}
            >
              {formatKobo(transaction.totalKobo || transaction.amountKobo).replace('₦', '')}
            </AppText>
          </View>
          <View style={styles.badges}>
            <Badge label={statusLabel(transaction.status)} tone={tone} />
            <Badge label={serviceLabel(transaction.type)} tone="neutral" />
          </View>
          <AppText variant="caption" color="textMuted" align="center">
            {TRANSACTION_STATUS_EXPLANATIONS[transaction.status]}
          </AppText>
          {transaction.status === 'uncertain' ? (
            <Card tone="alt" style={[styles.warning, { borderColor: colors.warning }]}>
              <Ionicons name="warning-outline" size={18} color={colors.warning} />
              <AppText variant="caption" color="textMuted" style={styles.warningText}>
                Do not retry this purchase. The debit stays in place to prevent a double charge.
                Refresh the status or contact support so we can reconcile it with the supplier.
              </AppText>
            </Card>
          ) : null}
        </Card>
      </FadeUp>

      <FadeUp delay={60} style={styles.actions}>
        <Button
          label="Download receipt"
          icon="arrow-down-circle-outline"
          onPress={() => void download()}
          loading={downloading}
        />
        {canRefresh ? (
          <Button
            label={refreshing ? 'Checking…' : 'Refresh status'}
            variant="secondary"
            icon="refresh-outline"
            onPress={() => void onRefresh()}
            loading={refreshing}
          />
        ) : null}
      </FadeUp>

      {token ? (
        <FadeUp delay={90}>
          <Card tone="accent" style={styles.secret}>
            <View style={styles.secretHeader}>
              <AppText variant="micro" color="accent">
                Prepaid token
              </AppText>
              <Pressable
                onPress={() => copy(token, 'Token')}
                accessibilityRole="button"
                accessibilityLabel="Copy prepaid token"
                hitSlop={8}
                style={styles.copyRow}
              >
                <Ionicons name="copy-outline" size={14} color={colors.accent} />
                <AppText variant="caption" color="accent">
                  Copy
                </AppText>
              </Pressable>
            </View>
            <AppText variant="mono" selectable>
              {token}
            </AppText>
            <AppText variant="caption" color="textMuted">
              Keep this token safe. You need it to load the units on your meter.
            </AppText>
          </Card>
        </FadeUp>
      ) : null}

      {vouchers.length > 0 ? (
        <FadeUp delay={100}>
          <Card tone="primary" style={styles.secret}>
            <AppText variant="micro" color="primary">
              Vouchers ({vouchers.length})
            </AppText>
            {vouchers.map((voucher, index) => (
              <View key={`${voucher.serial}-${index}`} style={styles.voucher}>
                <View style={styles.voucherCopy}>
                  <AppText variant="caption" color="textMuted">
                    Serial {voucher.serial || '—'}
                  </AppText>
                  <AppText variant="mono" selectable>
                    {voucher.pin || '—'}
                  </AppText>
                </View>
                {voucher.pin ? (
                  <Pressable
                    onPress={() => copy(voucher.pin, 'Voucher PIN')}
                    accessibilityRole="button"
                    accessibilityLabel="Copy voucher PIN"
                    hitSlop={8}
                    style={styles.copyRow}
                  >
                    <Ionicons name="copy-outline" size={14} color={colors.primary} />
                    <AppText variant="caption" color="primary">
                      Copy
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <AppText variant="caption" color="textMuted">
              Each PIN can only be used once. Keep this receipt private.
            </AppText>
          </Card>
        </FadeUp>
      ) : null}

      <FadeUp delay={120}>
        <Card style={styles.receipt}>
          <AppText variant="bodyStrong">Transaction details</AppText>
          <Row label="Reference" value={transaction.reference} mono />
          <Row label="Recipient" value={transactionSubtitle(transaction) || '—'} />
          <Row
            label={transaction.type === 'airtime' && transaction.feeKobo > 0 ? 'Airtime amount' : 'Amount'}
            value={formatKobo(transaction.amountKobo)}
          />
          <Row
            label={transaction.type === 'airtime' && transaction.feeKobo > 0 ? 'Service fee' : 'Fee'}
            value={formatKobo(transaction.feeKobo)}
          />
          <Row
            label={transaction.type === 'airtime' && transaction.feeKobo > 0 ? 'Total debit' : 'Total'}
            value={formatKobo(transaction.totalKobo)}
          />
          <Row label="Created" value={formatDateTime(transaction.createdAt)} />
          <Row label="Updated" value={formatDateTime(transaction.updatedAt)} />
          {transaction.completedAt ? (
            <Row label="Completed" value={formatDateTime(transaction.completedAt)} />
          ) : null}
          {transaction.providerReference ? (
            <Row label="Provider ref" value={transaction.providerReference} mono />
          ) : null}
          {transaction.failureReason ? (
            <Row label="Reason" value={transaction.failureReason} />
          ) : null}
          {providerMessage ? <Row label="Provider note" value={providerMessage} /> : null}
        </Card>
      </FadeUp>

      {detailEntries.length > 0 ? (
        <FadeUp delay={140}>
          <Card style={styles.receipt}>
            <AppText variant="bodyStrong">Service details</AppText>
            {detailEntries.map(([key, value]) => (
              <Row
                key={key}
                label={friendlyKeys[key] ?? key}
                value={
                  key.toLowerCase().includes('kobo') && typeof value === 'number'
                    ? formatKobo(value)
                    : String(value)
                }
              />
            ))}
          </Card>
        </FadeUp>
      ) : null}

      {wallet ? (
        <FadeUp delay={160}>
          <Card tone="alt" style={styles.walletCard}>
            <View style={styles.walletRow}>
              <Ionicons name="wallet-outline" size={18} color={colors.textSecondary} />
              <AppText variant="caption" color="textMuted">
                Wallet balance after this transaction
              </AppText>
            </View>
            <View style={styles.walletAmountRow}>
              <AppText variant="callout" color="textMuted" style={styles.walletCurrency}>
                ₦
              </AppText>
              <AppText variant="h3" tabular>
                {formatKobo(wallet.balanceKobo).replace('₦', '')}
              </AppText>
            </View>
          </Card>
        </FadeUp>
      ) : null}

      <Button
        label="Get help with this transaction"
        variant="secondary"
        icon="help-circle-outline"
        onPress={() =>
          router.push({
            pathname: '/support',
            params: {
              transactionId: transaction.id,
              reference: transaction.reference,
            },
          })
        }
      />

      {error ? (
        <AppText variant="caption" color="danger" align="center">
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}

function readVouchers(value: unknown): { pin: string; serial: string }[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      pin: typeof record.pin === 'string' ? record.pin : '',
      serial: typeof record.serial === 'string' ? record.serial : '',
    };
  });
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color="textMuted" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        color="textSecondary"
        style={styles.rowValue}
        tabular={mono}
        numberOfLines={3}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  amountCurrency: {
    marginTop: 10,
    fontSize: 18,
  },
  amount: {
    flexShrink: 1,
    fontSize: 42,
    lineHeight: 48,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginVertical: 2,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  warningText: {
    flex: 1,
  },
  copyIcon: {
    padding: spacing.xs,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  actions: {
    gap: spacing.xs,
  },
  secret: {
    gap: spacing.xs,
  },
  secretHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  voucher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  voucherCopy: {
    flex: 1,
    gap: 1,
  },
  receipt: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  rowLabel: {
    width: 110,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  walletCard: {
    gap: spacing.xs,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
  },
  walletCurrency: {
    marginTop: 5,
    fontSize: 15,
  },
  skeletonHero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  skeletonCard: {
    gap: spacing.md,
  },
});
