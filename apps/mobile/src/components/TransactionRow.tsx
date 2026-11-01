import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Transaction } from '@kashahara/shared';
import { useTheme } from '../providers/ThemeProvider';
import {
  formatKobo,
  formatRelativeDate,
  statusLabel,
  statusTone,
  transactionSubtitle,
  transactionTitle,
} from '../lib/format';
import { spacing } from '../theme/tokens';
import { serviceTint, toneColors } from '../theme/tones';
import { AppText } from './Text';
import { PressableScale } from './Motion';

const icons: Record<Transaction['type'], keyof typeof Ionicons.glyphMap> = {
  airtime: 'call-outline',
  data: 'cellular-outline',
  electricity: 'flash-outline',
  cable: 'tv-outline',
  exam: 'school-outline',
  wallet_funding: 'arrow-down-outline',
};

export interface TransactionRowProps {
  transaction: Transaction;
  onPress?: () => void;
  showStatus?: boolean;
}

export function TransactionRow({ transaction, onPress, showStatus = true }: TransactionRowProps) {
  const { colors, isDark } = useTheme();
  const tone = statusTone(transaction.status);
  const palette = toneColors(colors, tone);
  const tint = serviceTint(isDark, transaction.type);
  const credit = transaction.type === 'wallet_funding';
  const reversed = ['failed', 'reversed', 'refunded'].includes(transaction.status);
  const amountColor = credit ? colors.success : reversed ? colors.textMuted : colors.text;
  const amountLabel = `${credit ? '+' : '−'}${formatKobo(
    transaction.totalKobo || transaction.amountKobo,
  )}`;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${transactionTitle(transaction)}, ${amountLabel}, ${statusLabel(
        transaction.status,
      )}`}
      scaleTo={0.985}
      style={styles.row}
    >
      <View style={[styles.iconWrap, { backgroundColor: tint.background }]}>
        <Ionicons name={icons[transaction.type]} size={18} color={tint.foreground} />
      </View>
      <View style={styles.copy}>
        <AppText variant="callout" numberOfLines={1} style={styles.title}>
          {transactionTitle(transaction)}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {transactionSubtitle(transaction)} · {formatRelativeDate(transaction.createdAt)}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="callout" color={amountColor} numberOfLines={1} style={styles.amount}>
          {amountLabel}
        </AppText>
        {showStatus ? (
          <AppText variant="caption" color={palette.foreground} numberOfLines={1}>
            {statusLabel(transaction.status)}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  title: {
    letterSpacing: -0.2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 1,
    maxWidth: 132,
  },
  amount: {
    letterSpacing: -0.2,
  },
});
