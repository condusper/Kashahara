import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useToast } from '../../../src/providers/ToastProvider';
import { authApi, errorMessage } from '../../../src/lib/api';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { AppText } from '../../../src/components/Text';
import { TextField } from '../../../src/components/TextField';
import { Button } from '../../../src/components/Button';
import { FadeUp } from '../../../src/components/Motion';
import { radii, spacing } from '../../../src/theme/tokens';

export default function PasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid =
    newPassword.length >= 8 &&
    /[A-Za-z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    newPassword === confirm &&
    currentPassword.length > 0;

  const save = async () => {
    if (!valid) {
      setError(
        currentPassword.length === 0
          ? 'Enter your current password.'
          : newPassword.length < 8
            ? 'Use at least 8 characters for the new password.'
            : !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)
              ? 'Include at least one letter and one number.'
              : 'The new passwords do not match.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      toast.success('Password changed', 'Sign in again with your new password.');
      await signOut();
      router.replace('/sign-in');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header
        showBack
        eyebrow="Security"
        title="Password"
        subtitle="Keep your account protected"
      />

      <FadeUp delay={40} style={styles.form}>
        {error ? (
          <Card tone="alt" style={[styles.notice, { borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" color="danger" style={styles.noticeText}>
              {error}
            </AppText>
          </Card>
        ) : null}

        <TextField
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          leftIcon="lock-closed-outline"
        />
        <TextField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          leftIcon="lock-closed-outline"
          hint="At least 8 characters with a letter and a number."
        />
        <TextField
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          leftIcon="lock-closed-outline"
          error={confirm.length > 0 && confirm !== newPassword ? 'Passwords do not match.' : null}
        />

        <Button
          label="Change password"
          icon="checkmark-circle-outline"
          onPress={() => void save()}
          loading={saving}
          disabled={!valid}
          size="lg"
        />
      </FadeUp>

      <FadeUp delay={110}>
        <Card tone="alt" style={styles.tip}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={styles.tipText}>
            Changing your password signs out every other device. You will sign in again on this
            device with the new password.
          </AppText>
        </Card>
      </FadeUp>

      <FadeUp delay={160}>
        <View style={styles.rules}>
          <Rule label="At least 8 characters" met={newPassword.length >= 8} />
          <Rule label="One letter and one number" met={/[A-Za-z]/.test(newPassword) && /\d/.test(newPassword)} />
          <Rule label="Both entries match" met={confirm.length > 0 && confirm === newPassword} />
        </View>
      </FadeUp>
    </Screen>
  );
}

function Rule({ label, met }: { label: string; met: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.ruleRow}>
      <View
        style={[
          styles.ruleDot,
          { backgroundColor: met ? colors.successSoft : colors.surfaceAlt },
        ]}
      >
        <Ionicons
          name={met ? 'checkmark' : 'ellipse-outline'}
          size={met ? 11 : 8}
          color={met ? colors.success : colors.textMuted}
        />
      </View>
      <AppText variant="caption" color={met ? 'textSecondary' : 'textMuted'}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderRadius: radii.md,
  },
  noticeText: {
    flex: 1,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  tipText: {
    flex: 1,
  },
  rules: {
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ruleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
