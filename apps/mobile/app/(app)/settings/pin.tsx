import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { Badge } from '../../../src/components/Badge';
import { FadeUp } from '../../../src/components/Motion';
import { radii, spacing } from '../../../src/theme/tokens';

export default function TransactionPinScreen() {
  const toast = useToast();
  const { colors } = useTheme();
  const { user, setUser } = useAuth();

  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pinValid = /^\d{4}$/.test(pin);
  const matches = pin === confirm;
  const canSave = password.length > 0 && pinValid && matches && !saving;

  const save = async () => {
    if (!canSave) {
      setError(
        !password
          ? 'Enter your account password to authorise the PIN change.'
          : !pinValid
            ? 'Your transaction PIN must be exactly 4 digits.'
            : 'The PINs do not match.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await authApi.setPin({ password, pin });
      setUser(result.user);
      setPassword('');
      setPin('');
      setConfirm('');
      toast.success('Transaction PIN saved', 'Use it to authorise every purchase.');
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
        title="Transaction PIN"
        subtitle="A private 4-digit code for every purchase"
      />

      <FadeUp>
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="keypad-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.statusCopy}>
              <AppText variant="bodyStrong">PIN status</AppText>
              <AppText variant="caption" color="textMuted">
                {user?.hasTransactionPin
                  ? 'A PIN is set. Purchases require it every time.'
                  : 'No PIN yet. Set one before your first purchase.'}
              </AppText>
            </View>
            <Badge
              label={user?.hasTransactionPin ? 'Active' : 'Required'}
              tone={user?.hasTransactionPin ? 'success' : 'warning'}
              compact
            />
          </View>
        </Card>
      </FadeUp>

      <FadeUp delay={70} style={styles.form}>
        <AppText variant="micro" color="textMuted" style={styles.sectionLabel}>
          {user?.hasTransactionPin ? 'Change your PIN' : 'Create your PIN'}
        </AppText>

        {error ? (
          <Card tone="alt" style={[styles.notice, { borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" color="danger" style={styles.noticeText}>
              {error}
            </AppText>
          </Card>
        ) : null}

        <TextField
          label="Account password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          leftIcon="lock-closed-outline"
          hint="Your password authorises this change. We never store it on this device."
        />

        <View style={styles.pinRow}>
          <View style={styles.pinField}>
            <TextField
              label="New PIN"
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              leftIcon="keypad-outline"
              hint="Exactly 4 digits."
            />
          </View>
          <View style={styles.pinField}>
            <TextField
              label="Confirm PIN"
              value={confirm}
              onChangeText={(value) => setConfirm(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              leftIcon="keypad-outline"
              error={confirm.length > 0 && !matches ? 'PINs do not match.' : null}
            />
          </View>
        </View>

        <Button
          label={user?.hasTransactionPin ? 'Update PIN' : 'Save PIN'}
          icon="checkmark-circle-outline"
          onPress={() => void save()}
          loading={saving}
          disabled={!canSave}
          size="lg"
        />
      </FadeUp>

      <FadeUp delay={140}>
        <Card tone="alt" style={styles.tip}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <AppText variant="caption" color="textMuted" style={styles.tipText}>
            Choose a PIN you do not use anywhere else. If you forget it, you can reset it here with
            your account password.
          </AppText>
        </Card>
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: {
    flex: 1,
    gap: 2,
  },
  form: {
    gap: spacing.md,
  },
  sectionLabel: {
    marginLeft: 2,
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
  pinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pinField: {
    flex: 1,
    minWidth: 0,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  tipText: {
    flex: 1,
  },
});
