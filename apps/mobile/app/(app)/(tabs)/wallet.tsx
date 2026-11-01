import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LedgerEntry } from '@kashahara/shared';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useWalletData } from '../../../src/hooks/useWalletData';
import { formatDateTime, formatKobo } from '../../../src/lib/format';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { BalanceCard } from '../../../src/components/BalanceCard';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';
import { AppText } from '../../../src/components/Text';
import { Button } from '../../../src/components/Button';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { EmptyState } from '../../../src/components/EmptyState';
import { Skeleton } from '../../../src/components/Skeleton';
import { radii, spacing } from '../../../src/theme/tokens';

const kindLabels: Record<string, string> = {
  wallet_funding: 'Wallet funding',
  airtime: 'Airtime purchase',
  data: 'Data purchase',
  electricity: 'Electricity payment',
  cable: 'Cable TV subscription',
  exam: 'Exam PIN purchase',
  reversal: 'Reversal to wallet',
};

export default function WalletScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { wallet, setWallet } = useAuth();
  const { data, loading, refreshing, error, reload, refresh } = useWalletData(setWallet);

  useFocusEffect(
    useCallback(() => {
      void reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const reconciliation = data?.reconciliation;
  const ledger = data?.ledger ?? [];

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <Header title="Wallet" subtitle="Balance, top-ups, and every movement" large />

      <BalanceCard
        balanceKobo={wallet?.balanceKobo ?? 0}
        onAddMoney={() => router.push('/add-money')}
      />

      <Card tone={reconciliation && !reconciliation.matches ? 'alt' : 'surface'}>
        <View style={styles.reconHeader}>
          <View style={styles.reconTitle}>
            <Ionicons
              name={reconciliation?.matches ? 'shield-checkmark' : 'alert-circle'}
              size={20}
              color={
                reconciliation?.matches ? colors.success : reconciliation ? colors.warning : colors.textMuted
              }
            />
            <AppText variant="bodyStrong">Wallet integrity</AppText>
          </View>
          <Badge
            label={
              reconciliation
                ? reconciliation.matches
                  ? 'Reconciled'
                  : 'Check needed'
                : 'Checking'
            }
            tone={reconciliation ? (reconciliation.matches ? 'success' : 'warning') : 'neutral'}
          />
        </View>
        {loading && !reconciliation ? (
          <View style={styles.reconLoading}>
            <Skeleton width="70%" height={12} />
            <Skeleton width="50%" height={12} />
          </View>
        ) : reconciliation ? (
          <>
            <AppText variant="caption" color="textMuted">
              {reconciliation.matches
                ? 'Your wallet balance matches the sum of every ledger entry.'
                : 'The wallet balance and ledger do not match. Please contact support before making another purchase.'}
            </AppText>
            <View style={[styles.reconGrid, { borderColor: colors.border }]}>
              <View style={styles.reconCell}>
                <AppText variant="micro" color="textMuted">
                  Wallet
                </AppText>
                <AppText variant="callout" tabular>{formatKobo(reconciliation.walletBalanceKobo)}</AppText>
              </View>
              <View style={[styles.reconDivider, { backgroundColor: colors.border }]} />
              <View style={styles.reconCell}>
                <AppText variant="micro" color="textMuted">
                  Ledger
                </AppText>
                <AppText variant="callout" tabular>{formatKobo(reconciliation.ledgerBalanceKobo)}</AppText>
              </View>
            </View>
          </>
        ) : error ? (
          <View style={styles.reconError}>
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
            <Button
              label="Try again"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => void reload()}
            />
          </View>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button
          label="Add money"
          icon="add"
          onPress={() => router.push('/add-money')}
          style={styles.actionButton}
        />
        <Button
          label="Buy airtime"
          variant="secondary"
          icon="call-outline"
          onPress={() => router.push('/airtime')}
          style={styles.actionButton}
        />
      </View>

      <SectionHeader
        title="Ledger"
        subtitle="Newest first · every entry is immutable"
      />

      {loading && ledger.length === 0 ? (
        <Card style={styles.ledgerCard}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.skeletonRow}>
              <Skeleton width={36} height={36} radius={12} />
              <View style={styles.skeletonCopy}>
                <Skeleton width="50%" height={13} />
                <Skeleton width="35%" height={11} />
              </View>
              <Skeleton width={60} height={13} />
            </View>
          ))}
        </Card>
      ) : ledger.length === 0 ? (
        <Card>
          <EmptyState
            icon="wallet-outline"
            title="Your ledger is empty"
            description="Add money to your wallet to create your first ledger entry."
            actionLabel="Add money"
            onAction={() => router.push('/add-money')}
          />
        </Card>
      ) : (
        <Card style={styles.ledgerCard}>
          {ledger.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
              <LedgerRow entry={entry} />
            </View>
          ))}
        </Card>
      )}

      <AppText variant="caption" color="textMuted" align="center">
        Balances are stored as integer kobo. Ledger entries are append-only.
      </AppText>
    </Screen>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const { colors } = useTheme();
  const credit = entry.direction === 'credit';
  const color = credit ? colors.success : colors.text;

  return (
    <View style={styles.ledgerRow}>
      <View
        style={[
          styles.ledgerIcon,
          { backgroundColor: credit ? colors.successSoft : colors.surfaceAlt },
        ]}
      >
        <Ionicons
          name={credit ? 'arrow-down' : 'arrow-up'}
          size={17}
          color={credit ? colors.success : colors.textSecondary}
        />
      </View>
      <View style={styles.ledgerCopy}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {kindLabels[entry.kind] ?? entry.kind}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {formatDateTime(entry.createdAt)} · {entry.reference}
        </AppText>
      </View>
      <View style={styles.ledgerRight}>
        <AppText variant="bodyStrong" color={color} tabular numberOfLines={1}>
          {credit ? '+' : '-'}
          {formatKobo(entry.amountKobo)}
        </AppText>
        <AppText variant="caption" color="textMuted" tabular numberOfLines={1}>
          {formatKobo(entry.balanceAfterKobo)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  reconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reconLoading: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  reconGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  reconCell: {
    flex: 1,
    padding: spacing.sm,
    gap: 2,
  },
  reconDivider: {
    width: StyleSheet.hairlineWidth,
  },
  reconError: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  ledgerCard: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  ledgerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ledgerRight: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
    maxWidth: '46%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  skeletonCopy: {
    flex: 1,
    gap: 6,
  },
});
