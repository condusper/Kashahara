import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isValidNigerianPhone, normalizeNigerianPhone } from '@kashahara/shared';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { errorMessage } from '../../src/lib/api';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Header } from '../../src/components/Header';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { FadeUp } from '../../src/components/Motion';
import { radii, spacing } from '../../src/theme/tokens';

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validation = useMemo(() => {
    if (fullName.trim().length > 0 && fullName.trim().length < 2) {
      return 'Enter your full name.';
    }
    if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (phone.length > 0 && !isValidNigerianPhone(phone)) {
      return 'Enter a valid Nigerian phone number.';
    }
    if (password.length > 0 && password.length < 8) {
      return 'Use at least 8 characters for your password.';
    }
    if (password.length > 0 && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) {
      return 'Include at least one letter and one number.';
    }
    if (confirm.length > 0 && confirm !== password) {
      return 'Passwords do not match.';
    }
    return null;
  }, [fullName, email, phone, password, confirm]);

  const canSubmit =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    isValidNigerianPhone(phone) &&
    password.length >= 8 &&
    password === confirm &&
    accepted &&
    !loading;

  const submit = async () => {
    if (!canSubmit) {
      setError(validation ?? 'Check your details and accept the terms to continue.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizeNigerianPhone(phone),
        password,
      });
      toast.success('Account created', 'Set a transaction PIN before your first purchase.');
      router.replace('/');
    } catch (signUpError) {
      setError(errorMessage(signUpError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label="Create account"
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
          size="lg"
        />
      }
    >
      <Header showBack eyebrow="Kashahara" onBack={() => router.replace('/welcome')} />
      <FadeUp style={styles.hero}>
        <AppText variant="h1">Create your account</AppText>
        <AppText variant="body" color="textSecondary">
          A few details and your Kashahara wallet is ready.
        </AppText>
      </FadeUp>

      <FadeUp delay={80} style={styles.form}>
        {error || validation ? (
          <Card tone="alt" style={[styles.error, { borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" color="danger" style={styles.errorText}>
              {error ?? validation}
            </AppText>
          </Card>
        ) : null}

        <TextField
          label="Full name"
          placeholder="Adaeze Okafor"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          textContentType="name"
          leftIcon="person-outline"
          autoComplete="name"
        />
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          leftIcon="mail-outline"
        />
        <TextField
          label="Phone number"
          placeholder="0803 000 0000"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          leftIcon="call-outline"
          hint="We use this for your account and service receipts."
        />
        <TextField
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          leftIcon="lock-closed-outline"
          hint="Use at least 8 characters with a letter and a number."
        />
        <TextField
          label="Confirm password"
          placeholder="Re-enter your password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          textContentType="newPassword"
          leftIcon="lock-closed-outline"
          error={confirm.length > 0 && confirm !== password ? 'Passwords do not match.' : null}
        />

        <Pressable
          onPress={() => setAccepted((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          accessibilityLabel="Accept terms and privacy policy"
          style={styles.terms}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: accepted ? colors.primary : colors.borderStrong,
                backgroundColor: accepted ? colors.primary : 'transparent',
              },
            ]}
          >
            {accepted ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
          </View>
          <AppText variant="caption" color="textSecondary" style={styles.termsText}>
            I agree to the Kashahara terms of service and privacy policy.
          </AppText>
        </Pressable>
      </FadeUp>

      <FadeUp delay={150} style={styles.footer}>
        <AppText variant="caption" color="textMuted">
          Already have an account?
        </AppText>
        <Pressable
          onPress={() => router.push('/sign-in')}
          accessibilityRole="button"
          accessibilityLabel="Sign in instead"
        >
          <AppText variant="caption" color="primary">
            Sign in
          </AppText>
        </Pressable>
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
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
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  termsText: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
