import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useToast } from '../../../src/providers/ToastProvider';
import { SUPPORT_EMAIL } from '../../../src/lib/receipt';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { BrandMark } from '../../../src/components/BrandMark';
import { AppText } from '../../../src/components/Text';
import { ListRow } from '../../../src/components/ListRow';
import { FadeUp } from '../../../src/components/Motion';
import { spacing } from '../../../src/theme/tokens';

const version = Constants.expoConfig?.version ?? '0.1.0';

export default function AboutScreen() {
  const toast = useToast();
  const { colors } = useTheme();

  const emailSupport = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Kashahara%20support`).catch(() => {
      toast.info('Email support', SUPPORT_EMAIL);
    });
  };

  return (
    <Screen>
      <Header showBack eyebrow="Kashahara" title="About" subtitle="The app, the promise, the details" />

      <FadeUp>
        <View style={styles.hero}>
          <BrandMark size={68} />
          <AppText variant="h2" align="center" style={styles.wordmark}>
            Kashahara
          </AppText>
          <AppText variant="quote" color="textMuted" align="center" style={styles.tagline}>
            Everyday payments, handled with care.
          </AppText>
        </View>
      </FadeUp>

      <FadeUp delay={70}>
        <Card style={styles.listCard}>
          <ListRow
            icon="information-circle-outline"
            title="App version"
            value={version}
            showChevron={false}
          />
          <Divider />
          <ListRow
            icon="mail-outline"
            title="Contact support"
            subtitle={SUPPORT_EMAIL}
            onPress={emailSupport}
          />
          <Divider />
          <ListRow
            icon="globe-outline"
            title="Made for Nigeria"
            subtitle="Naira-first, network-aware, and receipted"
            showChevron={false}
          />
        </Card>
      </FadeUp>

      <FadeUp delay={130}>
        <Card tone="alt" style={styles.legal}>
          <View style={styles.legalTitle}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <AppText variant="bodyStrong">Our promise</AppText>
          </View>
          <AppText variant="callout" color="textSecondary">
            Kashahara keeps your wallet, transactions, and receipts in one calm place. We use
            encrypted transport, a transaction PIN for every purchase, and clear records you can
            download and keep.
          </AppText>
          <AppText variant="caption" color="textMuted">
            Prices and availability are shown before you confirm. If a service provider fails to
            deliver, our support team will investigate and make it right.
          </AppText>
        </Card>
      </FadeUp>

      <FadeUp delay={180}>
        <Card tone="alt" style={styles.legal}>
          <View style={styles.legalTitle}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
            <AppText variant="bodyStrong">Privacy and terms</AppText>
          </View>
          <AppText variant="caption" color="textMuted">
            We collect only what we need to run your account, process payments, and meet Nigerian
            regulatory requirements. Your details are never sold. By using Kashahara you agree to
            use the app lawfully and to keep your PIN and password private.
          </AppText>
        </Card>
      </FadeUp>

      <FadeUp delay={230}>
        <View style={styles.footnote}>
          <Ionicons name="heart-outline" size={13} color={colors.accent} />
          <AppText variant="caption" color="textMuted" align="center">
            Built for the everyday. Thank you for choosing Kashahara.
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
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  wordmark: {
    marginTop: spacing.xs,
  },
  tagline: {
    maxWidth: 280,
  },
  listCard: {
    paddingVertical: 2,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },
  legal: {
    gap: spacing.sm,
  },
  legalTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
  },
});
