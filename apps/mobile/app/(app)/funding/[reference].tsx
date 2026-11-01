import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import type { FundingAttempt, WalletSummary } from '@kashahara/shared';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useToast } from '../../../src/providers/ToastProvider';
import { useReceipt } from '../../../src/providers/ReceiptProvider';
import { errorMessage, walletApi } from '../../../src/lib/api';
import { formatDateTime, formatKobo } from '../../../src/lib/format';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';
import { AppText } from '../../../src/components/Text';
import { Button } from '../../../src/components/Button';
import { FadeUp, PopIn } from '../../../src/components/Motion';
import { radii, spacing } from '../../../src/theme/tokens';

const POLL_MS = 5000;
// Bank transfers can take a few minutes to settle. Keep checking for five
// minutes instead of giving up after one minute.
const MAX_POLLS = 60;

const statusTone = {
  awaiting_payment: 'info',
  successful: 'success',
  failed: 'danger',
  abandoned: 'neutral',
} as const;

const statusLabel = {
  awaiting_payment: 'Awaiting payment',
  successful: 'Funded',
  failed: 'Failed',
  abandoned: 'Abandoned',
} as const;

export default function FundingStatusScreen() {
  const router = useRouter();
  const toast = useToast();
  const receipt = useReceipt();
  const { colors } = useTheme();
  const { user, setWallet } = useAuth();
  const params = useLocalSearchParams<{ reference?: string }>();
  const reference = typeof params.reference === 'string' ? params.reference : '';

  const [funding, setFunding] = useState<FundingAttempt | null>(null);
  const [wallet, setWalletState] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polls = useRef(0);
  const fundingStatus = funding?.status;
  const fundingInstant = funding?.simulated;

  const load = useCallback(
    async (mode: 'initial' | 'check' = 'initial') => {
      if (!reference) {
        setError('Funding reference is missing.');
        setLoading(false);
        return;
      }
      if (mode === 'check') setChecking(true);
      else setLoading(true);
      try {
        const result = await walletApi.fundingStatus(reference);
        setFunding(result.funding);
        setWalletState(result.wallet);
        setWallet(result.wallet);
        setError(null);
      } catch (loadError) {
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
        setChecking(false);
      }
    },
    [reference, setWallet],
  );

  useEffect(() => {
    // State is only updated after the funding request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load('initial');
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      polls.current = 0;
      void load('check');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reference]),
  );

  // Returning from the bank app (OPay, Zap, etc.) backgrounds Expo Go. The
  // screen keeps navigation focus through that, so it must also re-check when
  // the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        polls.current = 0;
        void load('check');
      }
    });
    return () => subscription.remove();
  }, [load]);

  useEffect(() => {
    if (!fundingStatus || fundingStatus !== 'awaiting_payment' || fundingInstant) return;
    const timer = setInterval(() => {
      if (polls.current >= MAX_POLLS) {
        clearInterval(timer);
        return;
      }
      polls.current += 1;
      void load('check');
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [fundingStatus, fundingInstant, load]);

  const confirmPayment = async () => {
    if (!reference) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await walletApi.simulateFunding(reference);
      setFunding(result.funding);
      setWalletState(result.wallet);
      setWallet(result.wallet);
      toast.success('Wallet funded', 'Your balance has been updated.');
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    } finally {
      setConfirming(false);
    }
  };

  const download = async () => {
    if (!funding) return;
    setDownloading(true);
    try {
      const file = await receipt.downloadFunding(funding, {
        name: user?.fullName,
        email: user?.email,
        phone: user?.phone,
      });
      if (!file.shared) {
        toast.info('Receipt saved', 'Your receipt was saved on this device.');
      }
    } catch (downloadError) {
      toast.error('Could not create receipt', errorMessage(downloadError));
    } finally {
      setDownloading(false);
    }
  };

  const openCheckout = async () => {
    if (!funding?.authorizationUrl) return;
    try {
      if (funding.callbackUrl) {
        // Resolve as soon as Paystack redirects back to the app, then verify
        // immediately instead of waiting for the next poll.
        await WebBrowser.openAuthSessionAsync(funding.authorizationUrl, funding.callbackUrl, {
          controlsColor: colors.primary,
        });
      } else {
        await WebBrowser.openBrowserAsync(funding.authorizationUrl, {
          controlsColor: colors.primary,
        });
      }
    } catch {
      setError('Could not open the checkout. Use the link below in your browser.');
    }
    void load('check');
  };

  const successful = funding?.status === 'successful';
  const failed = funding?.status === 'failed' || funding?.status === 'abandoned';

  return (
    <Screen>
      <Header showBack eyebrow="Wallet" title="Funding status" subtitle={reference || 'Wallet funding'} />

      {loading && !funding ? (
        <Card style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" color="textMuted">
            Checking your funding attempt…
          </AppText>
        </Card>
      ) : error && !funding ? (
        <Card tone="alt" style={[styles.errorCard, { borderColor: colors.danger }]}>
          <AppText variant="bodyStrong">Could not load this funding attempt</AppText>
          <AppText variant="caption" color="textMuted">
            {error}
          </AppText>
          <Button label="Try again" variant="secondary" size="sm" fullWidth={false} onPress={() => void load('check')} />
        </Card>
      ) : funding ? (
        <>
          <FadeUp>
            <Card
              tone={successful ? 'primary' : failed ? 'alt' : 'surface'}
              style={styles.hero}
            >
              <PopIn>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: successful
                        ? colors.successSoft
                        : failed
                          ? colors.dangerSoft
                          : colors.infoSoft,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      successful
                        ? 'checkmark-circle'
                        : failed
                          ? 'close-circle'
                          : 'time-outline'
                    }
                    size={38}
                    color={
                      successful ? colors.success : failed ? colors.danger : colors.info
                    }
                  />
                </View>
              </PopIn>
              <AppText variant="h2" align="center">
                {successful
                  ? 'Wallet funded'
                  : failed
                    ? 'Funding did not complete'
                    : 'Waiting for payment confirmation'}
              </AppText>
              <View style={styles.amountRow}>
                <AppText variant="callout" color="textMuted" style={styles.amountCurrency}>
                  ₦
                </AppText>
                <AppText
                  variant="display"
                  align="center"
                  tabular
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={styles.amount}
                >
                  {formatKobo(funding.amountKobo).replace('₦', '')}
                </AppText>
              </View>
              <Badge
                label={statusLabel[funding.status]}
                tone={statusTone[funding.status]}
              />
              <AppText variant="caption" color="textMuted" align="center">
                {successful
                  ? 'The server verified this payment and credited your wallet. The balance below comes from the API.'
                  : failed
                    ? 'No credit was applied. If money left your account, contact support with this reference.'
                    : 'Complete the secure checkout. This screen checks the server automatically.'}
              </AppText>
            </Card>
          </FadeUp>

          <FadeUp delay={70}>
            <Card style={styles.details}>
              <Row label="Reference" value={funding.reference} mono />
              <Row label="Provider" value="Paystack" />
              <Row label="Created" value={formatDateTime(funding.createdAt)} />
              <Row
                label="Completed"
                value={funding.completedAt ? formatDateTime(funding.completedAt) : 'Not yet'}
              />
              {wallet ? (
                <Row label="Wallet balance" value={formatKobo(wallet.balanceKobo)} />
              ) : null}
            </Card>
          </FadeUp>

          {error ? (
            <Card tone="alt" style={[styles.errorCard, { borderColor: colors.danger }]}>
              <AppText variant="caption" color="danger">
                {error}
              </AppText>
            </Card>
          ) : null}

          {funding.status === 'awaiting_payment' && funding.simulated ? (
            <Button
              label={confirming ? 'Confirming…' : 'Confirm payment'}
              onPress={() => void confirmPayment()}
              loading={confirming}
            />
          ) : null}

          {funding.status === 'awaiting_payment' && !funding.simulated ? (
            <>
              {funding.authorizationUrl ? (
                <Button
                  label="Open checkout"
                  icon="open-outline"
                  onPress={() => void openCheckout()}
                />
              ) : null}
              <Button
                label={checking ? 'Checking…' : 'Check payment status'}
                variant="secondary"
                onPress={() => void load('check')}
                loading={checking}
              />
              <AppText variant="caption" color="textMuted" align="center">
                We check automatically for about a minute. You can also return to this screen
                later; the server is the source of truth.
              </AppText>
            </>
          ) : null}

          {successful ? (
            <>
              <Button
                label="Download receipt"
                icon="arrow-down-circle-outline"
                onPress={() => void download()}
                loading={downloading}
              />
              <Button label="Back to wallet" variant="secondary" onPress={() => router.replace('/wallet')} />
              <Button
                label="Add more money"
                variant="ghost"
                onPress={() => router.replace('/add-money')}
              />
            </>
          ) : null}

          {failed ? (
            <Button
              label="Start a new funding attempt"
              onPress={() => router.replace('/add-money')}
            />
          ) : null}
        </>
      ) : null}

      <Button
        label="Back to home"
        variant="ghost"
        onPress={() => router.replace('/(app)/(tabs)' as Href)}
      />
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color="textMuted" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        color="textSecondary"
        style={styles.rowValue}
        tabular={mono}
        numberOfLines={2}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  amountCurrency: {
    marginTop: 10,
    fontSize: 18,
  },
  amount: {
    flexShrink: 1,
    fontSize: 42,
    lineHeight: 48,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  details: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  rowLabel: {
    width: 100,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  errorCard: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
});
