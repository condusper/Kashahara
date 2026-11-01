import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useAuth } from '../../../src/providers/AuthProvider';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { AppText } from '../../../src/components/Text';
import { ListRow } from '../../../src/components/ListRow';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { FadeUp } from '../../../src/components/Motion';
import { spacing } from '../../../src/theme/tokens';

const themeLabels = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
} as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const { user } = useAuth();

  const verified = Boolean(user?.emailVerified && user?.phoneVerified);

  return (
    <Screen>
      <Header
        showBack
        eyebrow="Kashahara"
        title="Settings"
        subtitle="Your account, security, and preferences"
      />

      <FadeUp>
        <Card onPress={() => router.push('/profile' as Href)} style={styles.identity}>
          <Avatar name={user?.fullName ?? 'Kashahara'} size={52} />
          <View style={styles.identityCopy}>
            <AppText variant="h3" numberOfLines={1}>
              {user?.fullName ?? 'Kashahara customer'}
            </AppText>
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {user?.email ?? 'No email on file'}
            </AppText>
          </View>
          <Badge
            label={verified ? 'Verified' : 'Verify'}
            tone={verified ? 'success' : 'warning'}
            compact
          />
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>
      </FadeUp>

      <FadeUp delay={60} style={styles.section}>
        <SectionHeader title="Account" />
        <Card style={styles.listCard}>
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
            subtitle={verified ? 'Email and phone verified' : 'Confirm your contact details'}
            onPress={() => router.push('/verify' as Href)}
            right={verified ? null : <Badge label="Action" tone="warning" compact />}
          />
        </Card>
      </FadeUp>

      <FadeUp delay={110} style={styles.section}>
        <SectionHeader title="Security" />
        <Card style={styles.listCard}>
          <ListRow
            icon="keypad-outline"
            title="Transaction PIN"
            subtitle="Authorise every purchase"
            value={user?.hasTransactionPin ? 'Set' : 'Not set'}
            onPress={() => router.push('/settings/pin' as Href)}
          />
          <Divider />
          <ListRow
            icon="lock-closed-outline"
            title="Password"
            subtitle="Change your sign-in password"
            onPress={() => router.push('/settings/password' as Href)}
          />
          <Divider />
          <ListRow
            icon="shield-checkmark-outline"
            title="Sessions"
            subtitle="Devices signed in to your account"
            onPress={() => router.push('/settings/sessions' as Href)}
          />
        </Card>
      </FadeUp>

      <FadeUp delay={160} style={styles.section}>
        <SectionHeader title="Preferences" />
        <Card style={styles.listCard}>
          <ListRow
            icon="contrast-outline"
            title="Appearance"
            subtitle="Light, dark, or follow your device"
            value={themeLabels[mode]}
            onPress={() => router.push('/settings/appearance' as Href)}
          />
          <Divider />
          <ListRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Receipts, security alerts, and updates"
            onPress={() => router.push('/settings/notifications' as Href)}
          />
        </Card>
      </FadeUp>

      <FadeUp delay={210} style={styles.section}>
        <SectionHeader title="Support" />
        <Card style={styles.listCard}>
          <ListRow
            icon="help-circle-outline"
            title="Help and support"
            subtitle="FAQs, receipts, and contact form"
            onPress={() => router.push('/support' as Href)}
          />
          <Divider />
          <ListRow
            icon="information-circle-outline"
            title="About and legal"
            subtitle="Version, terms, and privacy"
            onPress={() => router.push('/settings/about' as Href)}
          />
        </Card>
      </FadeUp>

      <FadeUp delay={260}>
        <View style={styles.footnote}>
          <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" align="center">
            Your details are encrypted and never sold. Every payment is receipted.
          </AppText>
        </View>
      </FadeUp>
    </Screen>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityCopy: {
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
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
