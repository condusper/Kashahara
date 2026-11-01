import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useToast } from '../../../src/providers/ToastProvider';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { AppText } from '../../../src/components/Text';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { FadeUp } from '../../../src/components/Motion';
import { spacing } from '../../../src/theme/tokens';

const platformLabel =
  Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android device' : 'Web browser';

export default function SessionsScreen() {
  const toast = useToast();
  const { colors } = useTheme();
  const { signOutEverywhere } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    Alert.alert(
      'Sign out of all devices?',
      'Every active session, including this one, will be signed out. You will need your password to return.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void signOutEverywhere()
              .then(() => toast.success('Signed out everywhere', 'All sessions have been revoked.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Header
        showBack
        eyebrow="Security"
        title="Sessions"
        subtitle="Every place your account is signed in"
      />

      <FadeUp>
        <Card style={styles.current}>
          <View style={styles.currentRow}>
            <View style={[styles.deviceIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.currentCopy}>
              <AppText variant="bodyStrong">{platformLabel}</AppText>
              <AppText variant="caption" color="textMuted">
                This device · active now
              </AppText>
            </View>
            <Badge label="Current" tone="success" dot compact />
          </View>
        </Card>
      </FadeUp>

      <FadeUp delay={70}>
        <Card tone="alt" style={styles.explainer}>
          <AppText variant="h3">One account, one trusted circle</AppText>
          <AppText variant="callout" color="textSecondary">
            Changing your password revokes other sessions automatically. Signing out everywhere is
            the fastest way to close access if you no longer recognise a device.
          </AppText>
          <View style={styles.points}>
            <Point icon="checkmark-circle-outline" text="Your wallet balance and receipts stay safe." />
            <Point icon="checkmark-circle-outline" text="Your transaction PIN is never stored on a device." />
            <Point icon="checkmark-circle-outline" text="You can sign back in with your password." />
          </View>
        </Card>
      </FadeUp>

      <FadeUp delay={140}>
        <Button
          label="Sign out of all devices"
          variant="danger"
          icon="shield-outline"
          onPress={confirm}
          loading={busy}
          size="lg"
        />
      </FadeUp>

      <FadeUp delay={190}>
        <View style={styles.footnote}>
          <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" align="center">
            Sessions are protected with encrypted tokens and revoked instantly.
          </AppText>
        </View>
      </FadeUp>
    </Screen>
  );
}

function Point({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <AppText variant="caption" color="textSecondary" style={styles.pointText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  current: {
    gap: spacing.sm,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentCopy: {
    flex: 1,
    gap: 2,
  },
  explainer: {
    gap: spacing.sm,
  },
  points: {
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  pointText: {
    flex: 1,
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
  },
});
