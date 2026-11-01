import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useToast } from '../../../src/providers/ToastProvider';
import { formatKobo } from '../../../src/lib/format';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { AppText } from '../../../src/components/Text';
import { Button } from '../../../src/components/Button';
import { ListRow } from '../../../src/components/ListRow';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { FadeUp } from '../../../src/components/Motion';
import { radii, spacing } from '../../../src/theme/tokens';

const version = Constants.expoConfig?.version ?? '0.1.0';

export default function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user, wallet, signOut, signOutEverywhere } = useAuth();
  const [busy, setBusy] = useState<'signout' | 'all' | null>(null);

  const verified = Boolean(user?.emailVerified && user?.phoneVerified);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need your password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setBusy('signout');
          void signOut().finally(() => setBusy(null));
        },
      },
    ]);
  };

  const confirmSignOutEverywhere = () => {
    Alert.alert(
      'Sign out of all devices?',
      'Every active session, including this one, will be signed out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere',
          style: 'destructive',
          onPress: () => {
            setBusy('all');
            void signOutEverywhere().finally(() => setBusy(null));
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Header eyebrow="Kashahara" title="Account" subtitle="Your profile and preferences" large />

      <FadeUp>
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={user?.fullName ?? 'Kashahara'} size={58} />
            <View style={styles.profileCopy}>
              <AppText variant="h3" numberOfLines={1}>
                {user?.fullName ?? 'Kashahara customer'}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {user?.email ?? 'No email on file'}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {user?.phone ?? 'No phone on file'}
              </AppText>
            </View>
            <Badge
              label={verified ? 'Verified' : 'Unverified'}
              tone={verified ? 'success' : 'warning'}
              icon={verified ? 'shield-checkmark' : 'alert-circle-outline'}
              compact
            />
          </View>

          <View style={[styles.balanceStrip, { borderColor: colors.border }]}>
            <View style={styles.balanceCell}>
              <AppText variant="micro" color="textMuted">
                Wallet
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {formatKobo(wallet?.balanceKobo ?? 0)}
              </AppText>
            </View>
            <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
            <View style={styles.balanceCell}>
              <AppText variant="micro" color="textMuted">
                Transaction PIN
              </AppText>
              <AppText variant="bodyStrong" color={user?.hasTransactionPin ? 'text' : 'warning'}>
                {user?.hasTransactionPin ? 'Set' : 'Not set'}
              </AppText>
            </View>
          </View>

          <Button
            label="Edit profile"
            variant="secondary"
            icon="create-outline"
            onPress={() => router.push('/profile' as Href)}
          />
        </Card>
      </FadeUp>

      {!user?.hasTransactionPin ? (
        <FadeUp delay={70}>
          <Card tone="accent" style={styles.nudge}>
            <View style={[styles.nudgeIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="keypad-outline" size={19} color={colors.accent} />
            </View>
            <View style={styles.nudgeCopy}>
              <AppText variant="bodyStrong">Protect your purchases</AppText>
              <AppText variant="caption" color="textSecondary">
                Set a 4-digit transaction PIN before buying airtime, data, or bills.
              </AppText>
            </View>
            <Button
              label="Set PIN"
              size="sm"
              variant="gold"
              fullWidth={false}
              onPress={() => router.push('/settings/pin' as Href)}
            />
          </Card>
        </FadeUp>
      ) : null}

      <FadeUp delay={120} style={styles.section}>
        <SectionHeader title="Manage account" />
        <Card style={styles.listCard}>
          <ListRow
            icon="settings-outline"
            title="Settings"
            subtitle="Appearance, security, notifications, and more"
            onPress={() => router.push('/settings' as Href)}
          />
          <Divider />
          <ListRow
            icon="person-outline"
            title="Profile details"
            subtitle="Name, email, and phone number"
            onPress={() => router.push('/profile' as Href)}
          />
          <Divider />
          <ListRow
            icon="ribbon-outline"
            title="Verification"
            subtitle={verified ? 'Email and phone verified' : 'Verify your email and phone number'}
            onPress={() => router.push('/verify' as Href)}
            right={verified ? null : <Badge label="Action" tone="warning" compact />}
          />
          <Divider />
          <ListRow
            icon="help-circle-outline"
            title="Help and support"
            subtitle="FAQs, receipts, and contact form"
            onPress={() => router.push('/support' as Href)}
          />
        </Card>
      </FadeUp>

      <FadeUp delay={180} style={styles.section}>
        <SectionHeader title="Session" subtitle="Signing out keeps your wallet safe on shared devices" />
        <View style={styles.sessionActions}>
          <Button
            label="Sign out"
            variant="secondary"
            icon="log-out-outline"
            onPress={confirmSignOut}
            loading={busy === 'signout'}
          />
          <Button
            label="Sign out of all devices"
            variant="danger"
            icon="shield-outline"
            onPress={confirmSignOutEverywhere}
            loading={busy === 'all'}
          />
        </View>
      </FadeUp>

      <Pressable
        onPress={() => toast.info(`Kashahara ${version}`, "You're on the latest version.")}
        accessibilityRole="button"
        accessibilityLabel="App version"
        style={styles.version}
      >
        <AppText variant="caption" color="textMuted" align="center">
          {`Kashahara ${version} · Made for Nigeria`}
        </AppText>
        <AppText variant="caption" color="textMuted" align="center">
          Your wallet and your records, always within reach.
        </AppText>
      </Pressable>
    </Screen>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  profileCard: {
    gap: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileCopy: {
    flex: 1,
    gap: 2,
  },
  balanceStrip: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  balanceCell: {
    flex: 1,
    padding: spacing.sm,
    gap: 4,
  },
  balanceDivider: {
    width: StyleSheet.hairlineWidth,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nudgeIcon: {
    width: 42,
    height: 42,
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
  listCard: {
    paddingVertical: 2,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },
  sessionActions: {
    gap: spacing.xs,
  },
  version: {
    gap: 2,
    paddingVertical: spacing.md,
  },
});
