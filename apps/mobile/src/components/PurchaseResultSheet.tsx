import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Transaction } from '@kashahara/shared';
import { TRANSACTION_STATUS_EXPLANATIONS } from '@kashahara/shared';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { useToast } from '../providers/ToastProvider';
import { useReceipt } from '../providers/ReceiptProvider';
import { errorMessage } from '../lib/api';
import { formatDateTime, formatKobo, statusLabel, statusTone, transactionTitle } from '../lib/format';
import { toneColors } from '../theme/tones';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './Text';
import { Badge } from './Badge';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { PopIn } from './Motion';

export interface PurchaseResultSheetProps {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onViewReceipt: (id: string) => void;
}

export function PurchaseResultSheet({
  visible,
  transaction,
  onClose,
  onViewReceipt,
}: PurchaseResultSheetProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const receipt = useReceipt();
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const token = transaction && typeof transaction.details.token === 'string'
    ? transaction.details.token
    : null;
  const vouchers = transaction ? readVouchers(transaction.details.vouchers) : [];
  const providerMessage =
    transaction && typeof transaction.details.providerMessage === 'string'
      ? transaction.details.providerMessage
      : null;

  if (!transaction) return null;

  const tone = statusTone(transaction.status);
  const palette = toneColors(colors, tone);
  const successful = transaction.status === 'successful';
  const uncertain = transaction.status === 'uncertain' || transaction.status === 'processing';
  const title = successful
    ? 'Purchase successful'
    : uncertain
      ? 'Status uncertain'
      : transaction.status === 'refunded' || transaction.status === 'reversed'
        ? 'Refunded to wallet'
        : transaction.status === 'failed'
          ? 'Purchase failed'
          : 'Order received';
  const icon = successful
    ? 'checkmark'
    : uncertain
      ? 'time-outline'
      : transaction.status === 'failed'
        ? 'close'
        : 'return-up-back';

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

  const copy = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy', 'Select the value and copy it manually.');
    }
  };

  const handleDownload = async () => {
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

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissable
      footer={
        <>
          <Button
            label="Download receipt"
            icon="arrow-down-circle-outline"
            onPress={() => void handleDownload()}
            loading={downloading}
          />
          <Button
            label="View receipt"
            onPress={() => onViewReceipt(transaction.id)}
            variant="secondary"
          />
          <Button label="Done" onPress={onClose} variant="ghost" />
        </>
      }
    >
      <View style={styles.hero}>
        <PopIn>
          <SuccessOrb icon={icon} tone={palette.foreground} background={palette.background} />
        </PopIn>
        <AppText variant="h2" align="center">
          {title}
        </AppText>
        <AppText
          variant="display"
          align="center"
          style={styles.amount}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatKobo(transaction.totalKobo || transaction.amountKobo)}
        </AppText>
        <Badge label={statusLabel(transaction.status)} tone={tone} />
        <AppText variant="caption" color="textMuted" align="center" style={styles.explanation}>
          {TRANSACTION_STATUS_EXPLANATIONS[transaction.status]}
        </AppText>
      </View>

      <View style={[styles.receipt, { borderColor: colors.border }]}>
        <Row label="Service" value={transactionTitle(transaction)} />
        <Row label="Reference" value={transaction.reference} mono />
        <Row label="Date" value={formatDateTime(transaction.createdAt)} />
        {transaction.providerReference ? (
          <Row label="Provider ref" value={transaction.providerReference} mono />
        ) : null}
        {transaction.failureReason ? <Row label="Reason" value={transaction.failureReason} /> : null}
        {providerMessage ? <Row label="Provider note" value={providerMessage} /> : null}
      </View>

      {token ? (
        <View
          style={[styles.secret, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
        >
          <View style={styles.secretHeader}>
            <AppText variant="micro" color="accent">
              Prepaid token
            </AppText>
            <CopyButton value={token} label="Token" onCopy={copy} />
          </View>
          <AppText variant="mono" color="text" selectable>
            {token}
          </AppText>
          <AppText variant="caption" color="textMuted">
            Keep this token safe. You need it to load the units on your meter.
          </AppText>
        </View>
      ) : null}

      {vouchers.length > 0 ? (
        <View
          style={[styles.secret, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
        >
          <View style={styles.secretHeader}>
            <AppText variant="micro" color="primary">
              Exam PINs ({vouchers.length})
            </AppText>
          </View>
          {vouchers.map((voucher, index) => (
            <View key={`${voucher.serial}-${index}`} style={styles.voucher}>
              <View style={styles.voucherCopy}>
                <AppText variant="caption" color="textMuted">
                  Serial {voucher.serial || '—'}
                </AppText>
                <AppText variant="mono" color="text" selectable>
                  {voucher.pin || '—'}
                </AppText>
              </View>
              {voucher.pin ? (
                <CopyButton value={voucher.pin} label="PIN" onCopy={copy} />
              ) : null}
            </View>
          ))}
          <AppText variant="caption" color="textMuted">
            Each PIN can only be used once. Keep them private.
          </AppText>
        </View>
      ) : null}

      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide transaction details' : 'Show transaction details'}
        style={styles.toggle}
      >
        <AppText variant="caption" color="primary">
          {expanded ? 'Hide details' : 'Show all details'}
        </AppText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
      </Pressable>

      {expanded ? (
        <View style={[styles.receipt, { borderColor: colors.border }]}>
          <Row label="Transaction ID" value={transaction.id} mono />
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
          {Object.entries(transaction.details)
            .filter(([key, value]) => !hiddenKeys.has(key) && typeof value !== 'object')
            .map(([key, value]) => (
              <Row key={key} label={humanize(key)} value={String(value)} />
            ))}
        </View>
      ) : null}
    </Sheet>
  );
}

function SuccessOrb({
  icon,
  tone,
  background,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  background: string;
}) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withDelay(
      420,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600 }),
          withTiming(0, { duration: 1600 }),
        ),
        -1,
        false,
      ),
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.5 }],
  }));

  return (
    <View style={styles.orbWrap}>
      <Animated.View
        style={[
          styles.halo,
          { borderColor: tone, backgroundColor: background },
          haloStyle,
        ]}
      />
      <View style={[styles.outer, { backgroundColor: background }]}>
        <View style={[styles.inner, { backgroundColor: tone }]}>
          <Ionicons name={icon} size={30} color="#FFFFFF" />
        </View>
      </View>
      <View
        style={[styles.spark, styles.sparkTop, { backgroundColor: tone, opacity: 0.9 }]}
      />
      <View
        style={[styles.spark, styles.sparkBottom, { backgroundColor: colors.accent, opacity: 0.8 }]}
      />
    </View>
  );
}

function humanize(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
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

function CopyButton({
  value,
  label,
  onCopy,
}: {
  value: string;
  label: string;
  onCopy: (value: string, label: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onCopy(value, label)}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      hitSlop={8}
      style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name="copy-outline" size={14} color={colors.primary} />
      <AppText variant="caption" color="primary">
        Copy
      </AppText>
    </Pressable>
  );
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
        style={[styles.rowValue, mono ? { fontVariant: ['tabular-nums'] } : null]}
        numberOfLines={2}
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
    paddingBottom: spacing.xs,
  },
  orbWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  halo: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: StyleSheet.hairlineWidth,
  },
  outer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sparkTop: {
    top: 8,
    right: 14,
  },
  sparkBottom: {
    bottom: 14,
    left: 6,
  },
  amount: {
    marginVertical: 2,
    fontSize: 38,
    lineHeight: 44,
  },
  explanation: {
    maxWidth: 320,
    marginTop: 2,
  },
  receipt: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  rowLabel: {
    width: 100,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.xs,
  },
  secret: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  secretHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
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
});
