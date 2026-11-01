import React, { useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { Transaction } from '@kashahara/shared';
import { useTheme } from '../../../src/providers/ThemeProvider';
import {
  useTransactionsFeed,
  type TransactionFilter,
} from '../../../src/hooks/useTransactionsFeed';
import { dayLabel } from '../../../src/lib/format';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { SegmentedControl } from '../../../src/components/SegmentedControl';
import { Card } from '../../../src/components/Card';
import { TransactionRow } from '../../../src/components/TransactionRow';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { Skeleton } from '../../../src/components/Skeleton';
import { AppText } from '../../../src/components/Text';
import { spacing } from '../../../src/theme/tokens';

const filters: { value: TransactionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'airtime', label: 'Airtime' },
  { value: 'data', label: 'Data' },
  { value: 'electricity', label: 'Power' },
  { value: 'cable', label: 'TV' },
  { value: 'exam', label: 'Exam' },
  { value: 'wallet_funding', label: 'Wallet' },
];

function groupByDay(items: Transaction[]): { label: string; items: Transaction[] }[] {
  const groups: { label: string; items: Transaction[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const feed = useTransactionsFeed('all');
  const groups = useMemo(() => groupByDay(feed.items), [feed.items]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={feed.loading && feed.items.length > 0}
          onRefresh={() => void feed.refresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <Header title="Activity" subtitle="Every kobo, in one place" large />

      <SegmentedControl
        options={filters}
        value={feed.filter}
        onChange={feed.setFilter}
        scrollable
        accessibilityLabel="Filter transactions"
      />

      {feed.loading && feed.items.length === 0 ? (
        <Card style={styles.listCard}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.skeletonRow}>
              <Skeleton width={42} height={42} radius={14} />
              <View style={styles.skeletonCopy}>
                <Skeleton width="55%" height={13} />
                <Skeleton width="35%" height={11} />
              </View>
              <Skeleton width={58} height={13} />
            </View>
          ))}
        </Card>
      ) : feed.error ? (
        <Card tone="alt" style={styles.errorCard}>
          <AppText variant="bodyStrong">Could not load your activity</AppText>
          <AppText variant="caption" color="textMuted">
            {feed.error}
          </AppText>
          <Button
            label="Try again"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => void feed.refresh()}
          />
        </Card>
      ) : feed.items.length === 0 ? (
        <Card>
          <EmptyState
            icon="receipt-outline"
            title={feed.filter === 'all' ? 'No transactions yet' : 'Nothing in this filter'}
            description={
              feed.filter === 'all'
                ? 'Your airtime, data, bill, and wallet funding records will appear here.'
                : 'Try another service or clear the filter to see everything.'
            }
            actionLabel={feed.filter === 'all' ? 'Buy airtime' : 'Show all'}
            onAction={() =>
              feed.filter === 'all' ? router.push('/airtime') : feed.setFilter('all')
            }
          />
        </Card>
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.label} style={styles.group}>
              <AppText variant="micro" color="textMuted" style={styles.groupLabel}>
                {group.label}
              </AppText>
              <Card style={styles.listCard}>
                {group.items.map((transaction, index) => (
                  <View key={transaction.id}>
                    {index > 0 ? (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    ) : null}
                    <TransactionRow
                      transaction={transaction}
                      onPress={() =>
                        router.push(`/transaction/${transaction.id}` as Href)
                      }
                    />
                  </View>
                ))}
              </Card>
            </View>
          ))}

          {feed.nextCursor ? (
            <Button
              label={feed.loadingMore ? 'Loading…' : 'Load older transactions'}
              variant="secondary"
              onPress={feed.loadMore}
              loading={feed.loadingMore}
            />
          ) : (
            <AppText variant="caption" color="textMuted" align="center">
              That is everything in this view.
            </AppText>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listCard: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
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
  errorCard: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  groups: {
    gap: spacing.md,
  },
  group: {
    gap: spacing.xs,
  },
  groupLabel: {
    paddingLeft: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
});
