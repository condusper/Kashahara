import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { errorMessage, newIdempotencyKey, walletApi, type FundingResponse } from '../../src/lib/api';
import { formatKobo } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { AmountPad } from '../../src/components/AmountPad';
import { Card } from '../../src/components/Card';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { FadeUp } from '../../src/components/Motion';
import { spacing } from '../../src/theme/tokens';

const presets = [100_000, 200_000, 500_000, 1_000_000, 2_000_000];
const MIN_KOBO = 10_000;
const MAX_KOBO = 10_000_000;

export default function AddMoneyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [amountKobo, setAmountKobo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funding, setFunding] = useState<FundingResponse | null>(null);
  const keyRef = useRef<string | null>(null);

  const submit = async () => {
    if (amountKobo < MIN_KOBO || amountKobo > MAX_KOBO) {
      setError(
        `Enter an amount between ${formatKobo(MIN_KOBO, { decimals: false })} and ${formatKobo(
          MAX_KOBO,
          { decimals: false },
        )}.`,
      );
      return;
    }
    if (!user?.email) {
      setError('Your account has no email address. Add one in your profile before funding.');
      return;
    }
    setLoading(true);
    setError(null);
    // Reuse the same key for retries of this exact funding attempt.
    const key = keyRef.current ?? newIdempotencyKey('fund');
    keyRef.current = key;
    try {
      // Expo Go gets an `exp://` URL; a standalone build gets
      // `kashahara://funding`. The API appends the funding reference and sends
      // it to Paystack, which redirects here as soon as payment succeeds.
      const callbackBase = Linking.createURL('funding');
      const result = await walletApi.initializeFunding(amountKobo, callbackBase, key);
      keyRef.current = null;
      setFunding(result);
      if (result.mode === 'simulated') {
        router.push(`/funding/${result.funding.reference}` as Href);
        return;
      }
      if (result.authorizationUrl) {
        try {
          // openAuthSessionAsync closes the checkout and resolves as soon as
          // Paystack redirects to our callback, so the app comes straight back.
          await WebBrowser.openAuthSessionAsync(result.authorizationUrl, result.callbackUrl, {
            controlsColor: colors.primary,
          });
        } catch {
          // The status screen still offers the checkout link.
        }
      }
      router.replace(`/funding/${result.funding.reference}` as Href);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header showBack eyebrow="Wallet" title="Add money" subtitle="Fund your Kashahara wallet securely" />

      <FadeUp>
        <Card tone="alt" style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
          <View style={styles.noticeCopy}>
            <AppText variant="callout">Secure checkout</AppText>
            <AppText variant="caption" color="textMuted">
              You will continue to Paystack to complete this top-up. Kashahara never sees or
              stores your card details, and your wallet is credited only after our server
              verifies the payment.
            </AppText>
          </View>
        </Card>
      </FadeUp>

      <AmountPad
        valueKobo={amountKobo}
        onChange={(value) => {
          setAmountKobo(value);
          keyRef.current = null;
          setError(null);
          setFunding(null);
        }}
        presets={presets}
        minKobo={MIN_KOBO}
        maxKobo={MAX_KOBO}
        helper={`Minimum ${formatKobo(MIN_KOBO, { decimals: false })} · maximum ${formatKobo(
          MAX_KOBO,
          { decimals: false },
        )}`}
        submitLabel={
          amountKobo > 0 ? `Continue with ${formatKobo(amountKobo)}` : 'Continue to payment'
        }
        onSubmit={submit}
        loading={loading}
      />

      {error ? (
        <Card tone="alt" style={[styles.error, { borderColor: colors.danger }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <View style={styles.noticeCopy}>
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
            <AppText variant="caption" color="textMuted">
              If this was a network timeout, tap continue again. The same funding reference is
              reused, so you cannot be charged twice.
            </AppText>
          </View>
        </Card>
      ) : null}

      {funding ? (
        <Card tone="primary">
          <AppText variant="caption" color="textSecondary">
            Funding attempt {funding.funding.reference}
          </AppText>
          <AppText variant="bodyStrong">{funding.message}</AppText>
          <Button
            label="View funding status"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => router.push(`/funding/${funding.funding.reference}` as Href)}
          />
        </Card>
      ) : null}

      <FadeUp delay={80}>
        <Card style={styles.steps}>
          <AppText variant="bodyStrong">How funding works</AppText>
          <Step number="1" title="Choose an amount" body="Pick a preset or enter any amount." />
          <Step
            number="2"
            title="Complete checkout"
            body="Complete the payment in the secure checkout, then return to this screen."
          />
          <Step
            number="3"
            title="Server-verified credit"
            body="Your wallet is credited only after the API verifies the payment. The app never credits itself."
          />
        </Card>
      </FadeUp>

      <View style={styles.badges}>
        <Badge label="Encrypted" tone="success" icon="lock-closed-outline" />
        <Badge label="Idempotent" tone="neutral" icon="copy-outline" />
        <Badge label="Server verified" tone="neutral" icon="shield-outline" />
      </View>
    </Screen>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: colors.primarySoft }]}>
        <AppText variant="caption" color="primary">
          {number}
        </AppText>
      </View>
      <View style={styles.stepCopy}>
        <AppText variant="callout">{title}</AppText>
        <AppText variant="caption" color="textMuted">
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCopy: {
    flex: 1,
    gap: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
