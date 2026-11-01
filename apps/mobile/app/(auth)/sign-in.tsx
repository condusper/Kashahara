import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { errorMessage } from '../../src/lib/api';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Header } from '../../src/components/Header';
import { BrandMark } from '../../src/components/BrandMark';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { FadeUp } from '../../src/components/Motion';
import { radii, spacing } from '../../src/theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your email or phone number and your password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
      toast.success('Welcome back', 'Your session is secure on this device.');
      router.replace('/');
    } catch (signInError) {
      setError(errorMessage(signInError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label="Sign in"
          onPress={submit}
          loading={loading}
          disabled={!identifier || !password}
          size="lg"
        />
      }
    >
      <Header showBack eyebrow="Kashahara" onBack={() => router.replace('/welcome')} />
      <FadeUp style={styles.hero}>
        <BrandMark size={46} />
        <AppText variant="h1" style={styles.heading}>
          Welcome back
        </AppText>
        <AppText variant="body" color="textSecondary">
          Sign in to your wallet, services, and transaction history.
        </AppText>
      </FadeUp>

      <FadeUp delay={90} style={styles.form}>
        {error ? (
          <Card tone="alt" style={[styles.error, { borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" color="danger" style={styles.errorText}>
              {error}
            </AppText>
          </Card>
        ) : null}

        <TextField
          label="Email or phone"
          placeholder="you@example.com or 0803 000 0000"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          leftIcon="person-outline"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          leftIcon="lock-closed-outline"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <Pressable
          onPress={() => router.push('/forgot-password')}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
          style={styles.forgot}
        >
          <AppText variant="caption" color="primary">
            Forgot your password?
          </AppText>
        </Pressable>
      </FadeUp>

      <FadeUp delay={160} style={styles.footer}>
        <AppText variant="caption" color="textMuted">
          New to Kashahara?
        </AppText>
        <Pressable
          onPress={() => router.push('/sign-up')}
          accessibilityRole="button"
          accessibilityLabel="Create an account"
        >
          <AppText variant="caption" color="primary">
            Create an account
          </AppText>
        </Pressable>
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  heading: {
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  errorText: {
    flex: 1,
  },
  forgot: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xxs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
});
