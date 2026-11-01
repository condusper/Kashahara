import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { UserProfile } from '@kashahara/shared';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { authApi, errorMessage } from '../../src/lib/api';
import { maskPhone } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { SectionHeader } from '../../src/components/SectionHeader';
import { FadeUp } from '../../src/components/Motion';
import { radii, spacing } from '../../src/theme/tokens';

type Channel = 'email' | 'phone';

export default function VerifyScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user, setUser } = useAuth();

  return (
    <Screen>
      <Header showBack eyebrow="Account" title="Verification" subtitle="Confirm your email and phone number" />

      <FadeUp>
        <Card tone="alt">
          <AppText variant="caption" color="textMuted">
            Verified contact details help secure your account and let us reach you about
            orders. Codes expire after 15 minutes and can only be used once.
          </AppText>
        </Card>
      </FadeUp>

      <FadeUp delay={50}>
        <SectionHeader title="Contact details" />
      </FadeUp>
      <FadeUp delay={80}>
        <ChannelCard
          channel="email"
          title="Email address"
          value={user?.email ?? 'No email on file'}
          verified={Boolean(user?.emailVerified)}
          onVerified={(profile) => setUser(profile)}
          onToast={toast}
        />
      </FadeUp>
      <FadeUp delay={110}>
        <ChannelCard
          channel="phone"
          title="Phone number"
          value={user?.phone ? maskPhone(user.phone) : 'No phone on file'}
          verified={Boolean(user?.phoneVerified)}
          onVerified={(profile) => setUser(profile)}
          onToast={toast}
        />
      </FadeUp>

      {user?.emailVerified && user?.phoneVerified ? (
        <FadeUp delay={140}>
          <Card tone="primary" style={styles.done}>
            <View style={styles.doneRow}>
              <View style={[styles.doneIcon, { backgroundColor: colors.surface }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              </View>
              <View style={styles.doneCopy}>
                <AppText variant="bodyStrong">You are fully verified</AppText>
                <AppText variant="caption" color="textSecondary">
                  Your email and phone number are confirmed.
                </AppText>
              </View>
            </View>
            <Button
              label="Back to account"
              variant="secondary"
              size="sm"
              onPress={() => router.replace('/(app)/(tabs)/account')}
            />
          </Card>
        </FadeUp>
      ) : null}
    </Screen>
  );
}

function ChannelCard({
  channel,
  title,
  value,
  verified,
  onVerified,
  onToast,
}: {
  channel: Channel;
  title: string;
  value: string;
  verified: boolean;
  onVerified: (profile: UserProfile) => void;
  onToast: ReturnType<typeof useToast>;
}) {
  const { colors } = useTheme();
  const [requested, setRequested] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setRequesting(true);
    setError(null);
    try {
      const result = await authApi.requestVerification(channel);
      setRequested(true);
      setMessage(result.message);
      setDevCode(result.devCode ?? null);
      setCode('');
      if (result.devCode) {
        onToast.info('Code sent', 'Use the code shown below to verify.');
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRequesting(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const result = await authApi.confirmVerification(channel, code.trim());
      onVerified(result.user);
      setRequested(false);
      setMessage(null);
      setDevCode(null);
      setCode('');
      onToast.success(`${title} verified`, 'Your account is more secure.');
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: verified ? colors.successSoft : colors.surfaceAlt }]}>
          <Ionicons
            name={channel === 'email' ? 'mail-outline' : 'call-outline'}
            size={19}
            color={verified ? colors.success : colors.textSecondary}
          />
        </View>
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {value}
          </AppText>
        </View>
        <Badge
          label={verified ? 'Verified' : 'Unverified'}
          tone={verified ? 'success' : 'warning'}
          icon={verified ? 'checkmark-circle' : 'alert-circle-outline'}
          compact
        />
      </View>

      {verified ? (
        <AppText variant="caption" color="textMuted">
          This {channel === 'email' ? 'address' : 'number'} is confirmed.
        </AppText>
      ) : (
        <>
          {error ? (
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
          ) : null}

          {message ? (
            <View style={[styles.devBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <AppText variant="caption" color="textSecondary">
                {message}
              </AppText>
              {devCode ? (
                <View style={styles.devCodeRow}>
                  <AppText variant="micro" color="textMuted">
                    Your code
                  </AppText>
                  <AppText variant="mono" selectable>
                    {devCode}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          {requested ? (
            <>
              <TextField
                label="Verification code"
                value={code}
                onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                leftIcon="keypad-outline"
                hint="Enter the 6-digit code you received."
              />
              <View style={styles.actions}>
                <Button
                  label={confirming ? 'Verifying…' : 'Verify'}
                  onPress={() => void confirm()}
                  loading={confirming}
                  disabled={code.length !== 6}
                  style={styles.flex}
                />
                <Button
                  label="Resend"
                  variant="secondary"
                  onPress={() => void request()}
                  loading={requesting}
                  style={styles.flex}
                />
              </View>
            </>
          ) : (
            <Button
              label={`Send ${channel === 'email' ? 'email' : 'SMS'} code`}
              variant="secondary"
              icon="send-outline"
              onPress={() => void request()}
              loading={requesting}
            />
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  devBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.xs,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  devCodeRow: {
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  done: {
    gap: spacing.sm,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  doneIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCopy: {
    flex: 1,
    gap: 2,
  },
});
