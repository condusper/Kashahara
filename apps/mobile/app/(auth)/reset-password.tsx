import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { authApi, errorMessage } from '../../src/lib/api';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FadeUp } from '../../src/components/Motion';
import { spacing } from '../../src/theme/tokens';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(typeof params.token === 'string' ? params.token : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid =
    token.trim().length >= 20 &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    password === confirm;

  const submit = async () => {
    if (!valid) {
      setError('Enter the reset token and a matching password of at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword({ token: token.trim(), newPassword: password });
      toast.success('Password reset', 'Sign in with your new password.');
      router.replace('/sign-in');
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
          label="Set new password"
          onPress={submit}
          loading={loading}
          disabled={!valid}
          size="lg"
        />
      }
    >
      <Header showBack eyebrow="Kashahara" onBack={() => router.back()} />
      <FadeUp style={styles.hero}>
        <AppText variant="h1">Choose a new password</AppText>
        <AppText variant="body" color="textSecondary">
          Reset tokens expire quickly and can only be used once.
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

      <TextField
        label="Reset token"
        placeholder="Paste the token from your reset instructions"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        leftIcon="key-outline"
      />
      <TextField
        label="New password"
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        leftIcon="lock-closed-outline"
        hint="Include at least one letter and one number."
      />
      <TextField
        label="Confirm new password"
        placeholder="Re-enter your new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        leftIcon="lock-closed-outline"
        error={confirm.length > 0 && confirm !== password ? 'Passwords do not match.' : null}
      />
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
});
