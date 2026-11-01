import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useCatalog } from '../../../src/hooks/useCatalog';
import { useTransactionsFeed } from '../../../src/hooks/useTransactionsFeed';
import { Screen } from '../../../src/components/Screen';
import { AppText } from '../../../src/components/Text';
import { Avatar } from '../../../src/components/Avatar';
import { IconButton } from '../../../src/components/IconButton';
import { BalanceCard } from '../../../src/components/BalanceCard';
import { ServiceTile } from '../../../src/components/ServiceTile';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { TransactionRow } from '../../../src/components/TransactionRow';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { Skeleton } from '../../../src/components/Skeleton';
import { EmptyState } from '../../../src/components/EmptyState';
import { FadeInView, FadeUp } from '../../../src/components/Motion';
import { spacing } from '../../../src/theme/tokens';

const services: {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  tone: 'brand' | 'info' | 'warning' | 'success';
}[] = [
  {
    key: 'airtime',
    icon: 'call-outline',
    label: 'Airtime',
    description: 'Any network',
    tone: 'brand' as const,
  },
  {
    key: 'data',
    icon: 'wifi-outline',
    label: 'Data',
    description: 'Bundles',
    tone: 'info' as const,
  },
  {
    key: 'electricity',
    icon: 'flash-outline',
    label: 'Electricity',
    description: 'Meter tokens',
    tone: 'warning' as const,
  },
  {
    key: 'cable',
    icon: 'tv-outline',
    label: 'Cable TV',
    description: 'Subscriptions',
    tone: 'success' as const,
  },
  {
    key: 'exam',
    icon: 'school-outline',
    label: 'Exam PINs',
    description: 'WAEC, NECO',
    tone: 'brand' as const,
  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, wallet, refreshWallet } = useAuth();
  const { catalog } = useCatalog();
  const feed = useTransactionsFeed('all');
  const feedRefreshRef = useRef(feed.refresh);
  const firstFocus = useRef(true);

  useEffect(() => {
    feedRefreshRef.current = feed.refresh;
  }, [feed.refresh]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refreshWallet();
      void feedRefreshRef.current();
    }, [refreshWallet]),
  );

  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? 'there';
  const needsPin = user ? !user.hasTransactionPin : false;
  const unverified = user ? !user.emailVerified || !user.phoneVerified : false;
  const recent = feed.items.slice(0, 4);

  return (
    <Screen
      contentStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={feed.loading && feed.items.length > 0}
          onRefresh={() => {
            void refreshWallet();
            void feed.refresh();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <FadeInView style={styles.topRow}>
        <View style={styles.greeting}>
          <AppText variant="micro" color="accent">
            {greeting()}
          </AppText>
          <AppText variant="h1" numberOfLines={1}>
            {firstName}
          </AppText>
        </View>
        <View style={styles.topActions}>
          <IconButton
            icon="help-circle-outline"
            label="Support"
            onPress={() => router.push('/support')}
          />
          <Pressable
            onPress={() => router.push('/account')}
            accessibilityRole="button"
            accessibilityLabel="Open account"
          >
            <Avatar name={user?.fullName ?? 'Kashahara'} size={42} />
          </Pressable>
        </View>
      </FadeInView>

      <FadeUp delay={40}>
        <BalanceCard
          balanceKobo={wallet?.balanceKobo ?? 0}
          onAddMoney={() => router.push('/add-money')}
          onViewWallet={() => router.push('/wallet')}
        />
      </FadeUp>

      {needsPin ? (
        <FadeUp delay={100}>
          <Card tone="accent" style={styles.nudge}>
            <View style={[styles.nudgeIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="keypad-outline" size={19} color={colors.accent} />
            </View>
            <View style={styles.nudgeCopy}>
              <AppText variant="bodyStrong">Set your transaction PIN</AppText>
              <AppText variant="caption" color="textSecondary">
                A 4-digit PIN protects every purchase from your wallet.
              </AppText>
            </View>
            <Button
              label="Set PIN"
              size="sm"
              variant="gold"
              fullWidth={false}
              onPress={() => router.push('/settings/pin')}
            />
          </Card>
        </FadeUp>
      ) : unverified ? (
        <FadeUp delay={100}>
          <Card tone="alt" style={styles.nudge}>
            <View style={[styles.nudgeIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.warning} />
            </View>
            <View style={styles.nudgeCopy}>
              <AppText variant="bodyStrong">Verify your contact details</AppText>
              <AppText variant="caption" color="textSecondary">
                Verified details help us secure your account and reach you about orders.
              </AppText>
            </View>
            <Button
              label="Verify"
              size="sm"
              variant="secondary"
              fullWidth={false}
              onPress={() => router.push('/verify')}
            />
          </Card>
        </FadeUp>
      ) : null}

      <FadeUp delay={150} style={styles.section}>
        <SectionHeader
          title="Services"
          subtitle={`${catalog.dataPlans.length} data bundles and 5 everyday services`}
        />
        <View style={styles.grid}>
          {services.map((service, index) => (
            <ServiceTile
              key={service.key}
              icon={service.icon}
              label={service.label}
              description={service.description}
              tone={service.tone}
              containerStyle={[
                styles.gridItem,
                services.length % 2 === 1 && index === services.length - 1
                  ? styles.gridItemFull
                  : null,
              ]}
              onPress={() => router.push(`/${service.key}` as Href)}
            />
          ))}
        </View>
      </FadeUp>

      <FadeUp delay={220} style={styles.section}>
        <SectionHeader
          title="Recent activity"
          actionLabel="See all"
          onAction={() => router.push('/transactions')}
        />

        {feed.loading && recent.length === 0 ? (
          <Card style={styles.listCard}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.skeletonRow}>
                <Skeleton width={42} height={42} radius={14} />
                <View style={styles.skeletonCopy}>
                  <Skeleton width="60%" height={13} />
                  <Skeleton width="40%" height={11} />
                </View>
                <Skeleton width={64} height={13} />
              </View>
            ))}
          </Card>
        ) : feed.error && recent.length === 0 ? (
          <Card tone="alt" style={styles.errorCard}>
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
        ) : recent.length === 0 ? (
          <Card style={styles.listCard}>
            <EmptyState
              icon="sparkles"
              title="Your activity will appear here"
              description="Buy airtime, data, or a bill and every transaction will be recorded."
              actionLabel="Buy airtime"
              onAction={() => router.push('/airtime')}
            />
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {recent.map((transaction, index) => (
              <View key={transaction.id}>
                {index > 0 ? (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                ) : null}
                <TransactionRow
                  transaction={transaction}
                  onPress={() => router.push(`/transaction/${transaction.id}` as Href)}
                />
              </View>
            ))}
          </Card>
        )}
      </FadeUp>

      <FadeInView delay={300} style={styles.footnote}>
        <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
        <AppText variant="caption" color="textMuted" align="center">
          Secured with bank-grade encryption. Every payment comes with a receipt.
        </AppText>
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  greeting: {
    gap: 1,
    flex: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nudgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeCopy: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: spacing.sm,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 0,
  },
  gridItemFull: {
    flexBasis: '100%',
    flexGrow: 0,
  },
  listCard: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
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
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.xs,
  },
});
