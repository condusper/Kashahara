import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/providers/ThemeProvider';
import { authApi, errorMessage } from '../../src/lib/api';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FadeUp } from '../../src/components/Motion';
import { spacing } from '../../src/theme/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identifier.trim()) {
      setError('Enter the email or phone number on your account.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await authApi.forgotPassword(identifier.trim());
      setMessage(result.message);
      setDevToken(result.devToken ?? null);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label="Send reset instructions"
          onPress={submit}
          loading={loading}
          disabled={!identifier.trim()}
          size="lg"
        />
      }
    >
      <Header showBack eyebrow="Kashahara" onBack={() => router.back()} />
      <FadeUp style={styles.hero}>
        <AppText variant="h1">Reset your password</AppText>
        <AppText variant="body" color="textSecondary">
          Enter the email or phone number on your account. If it matches, we will send a
          short-lived reset token.
        </AppText>
      </FadeUp>

      {error ? (
        <Card tone="alt" style={[styles.notice, { borderColor: colors.danger }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <AppText variant="caption" color="danger" style={styles.noticeText}>
            {error}
          </AppText>
        </Card>
      ) : null}

      {message ? (
        <Card tone="alt" style={styles.notice}>
          <Ionicons name="mail-outline" size={18} color={colors.primary} />
          <View style={styles.noticeCopy}>
            <AppText variant="caption" color="textSecondary">
              {message}
            </AppText>
            {devToken ? (
              <>
                <AppText variant="micro" color="textMuted" style={styles.devLabel}>
                  Your reset code
                </AppText>
                <AppText variant="caption" color="text" selectable tabular style={styles.token}>
                  {devToken}
                </AppText>
                <Button
                  label="Choose a new password"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={() =>
                    router.push({ pathname: '/reset-password', params: { token: devToken } })
                  }
                />
              </>
            ) : null}
          </View>
        </Card>
      ) : null}

      <TextField
        label="Email or phone"
        placeholder="you@example.com or 0803 000 0000"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        leftIcon="at-outline"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={submit}
      />

      <Pressable
        onPress={() => router.push('/reset-password')}
        accessibilityRole="button"
        accessibilityLabel="I already have a reset token"
        style={styles.link}
      >
        <AppText variant="caption" color="primary">
          I already have a reset token
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noticeText: {
    flex: 1,
  },
  noticeCopy: {
    flex: 1,
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  devLabel: {
    marginTop: 2,
  },
  token: {
    letterSpacing: 0.6,
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xxs,
  },
});
