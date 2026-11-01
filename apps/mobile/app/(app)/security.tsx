import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { AppText } from '../../src/components/Text';
import { ListRow } from '../../src/components/ListRow';
import { Badge } from '../../src/components/Badge';
import { SectionHeader } from '../../src/components/SectionHeader';
import { FadeUp } from '../../src/components/Motion';
import { spacing } from '../../src/theme/tokens';

export default function SecurityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  return (
    <Screen>
      <Header
        showBack
        eyebrow="Kashahara"
        title="Security"
        subtitle="The few things that keep your wallet yours"
      />

      <FadeUp>
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.statusCopy}>
              <AppText variant="bodyStrong">Your account is protected</AppText>
              <AppText variant="caption" color="textMuted">
                A PIN for purchases, a password for sign-in, and instant session control.
              </AppText>
            </View>
          </View>
          <View style={[styles.statusStrip, { borderColor: colors.border }]}>
            <View style={styles.statusCell}>
              <AppText variant="micro" color="textMuted">
                Transaction PIN
              </AppText>
              <Badge
                label={user?.hasTransactionPin ? 'Active' : 'Required'}
                tone={user?.hasTransactionPin ? 'success' : 'warning'}
                compact
              />
            </View>
            <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statusCell}>
              <AppText variant="micro" color="textMuted">
                Contact checks
              </AppText>
              <Badge
                label={user?.emailVerified && user?.phoneVerified ? 'Verified' : 'Pending'}
                tone={user?.emailVerified && user?.phoneVerified ? 'success' : 'warning'}
                compact
              />
            </View>
          </View>
        </Card>
      </FadeUp>

      <FadeUp delay={70} style={styles.section}>
        <SectionHeader title="Manage" subtitle="Each setting has its own quiet space" />
        <Card style={styles.listCard}>
          <ListRow
            icon="keypad-outline"
            title="Transaction PIN"
            subtitle={user?.hasTransactionPin ? 'Change your 4-digit purchase PIN' : 'Set your purchase PIN'}
            onPress={() => router.push('/settings/pin' as Href)}
          />
          <Divider />
          <ListRow
            icon="lock-closed-outline"
            title="Password"
            subtitle="Change the password you sign in with"
            onPress={() => router.push('/settings/password' as Href)}
          />
          <Divider />
          <ListRow
            icon="shield-checkmark-outline"
            title="Sessions"
            subtitle="Review and revoke signed-in devices"
            onPress={() => router.push('/settings/sessions' as Href)}
          />
          <Divider />
          <ListRow
            icon="ribbon-outline"
            title="Verification"
            subtitle="Confirm your email and phone number"
            onPress={() => router.push('/verify' as Href)}
          />
        </Card>
      </FadeUp>

      <FadeUp delay={140}>
        <Card tone="alt" style={styles.tip}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={styles.tipText}>
            Kashahara will never ask for your PIN or password by message or phone. If someone does,
            stop and contact support.
          </AppText>
        </Card>
      </FadeUp>
    </Screen>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  statusCard: {
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: {
    flex: 1,
    gap: 2,
  },
  statusStrip: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
  },
  statusCell: {
    flex: 1,
    padding: spacing.sm,
    gap: 6,
  },
  statusDivider: {
    width: StyleSheet.hairlineWidth,
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
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  tipText: {
    flex: 1,
  },
});
