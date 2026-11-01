import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { isValidNigerianPhone, normalizeNigerianPhone } from '@kashahara/shared';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useAuth } from '../../src/providers/AuthProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { errorMessage } from '../../src/lib/api';
import { formatDate } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { Avatar } from '../../src/components/Avatar';
import { FadeUp } from '../../src/components/Motion';
import { spacing } from '../../src/theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normalizedPhone = useMemo(() => {
    try {
      return normalizeNigerianPhone(phone);
    } catch {
      return phone;
    }
  }, [phone]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneValid = isValidNigerianPhone(phone);
  const nameValid = fullName.trim().length >= 2;
  const emailChanged = email.trim().toLowerCase() !== user?.email;
  const phoneChanged = normalizedPhone !== user?.phone;
  const dirty = nameValid && (fullName.trim() !== user?.fullName || emailChanged || phoneChanged);

  const validation = useMemo(() => {
    if (fullName.trim().length > 0 && !nameValid) return 'Enter your full name.';
    if (email.length > 0 && !emailValid) return 'Enter a valid email address.';
    if (phone.length > 0 && !phoneValid) return 'Enter a valid Nigerian phone number.';
    return null;
  }, [fullName, email, phone, nameValid, emailValid, phoneValid]);

  const save = async () => {
    if (!dirty) return;
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        ...(emailChanged ? { email: email.trim().toLowerCase() } : {}),
        ...(phoneChanged ? { phone: normalizeNigerianPhone(phone) } : {}),
      });
      toast.success(
        'Profile updated',
        emailChanged || phoneChanged
          ? 'Your new contact details need verification.'
          : 'Your changes have been saved.',
      );
      if (emailChanged || phoneChanged) {
        router.push('/verify');
      }
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label={saving ? 'Saving…' : 'Save changes'}
          onPress={() => void save()}
          loading={saving}
          disabled={!dirty}
          size="lg"
        />
      }
    >
      <Header showBack title="Profile" subtitle="Your account details" />

      <FadeUp>
        <Card style={styles.identity}>
          <Avatar name={user?.fullName ?? 'Kashahara'} size={60} />
          <View style={styles.identityCopy}>
            <AppText variant="h3" numberOfLines={1}>
              {user?.fullName ?? 'Kashahara customer'}
            </AppText>
            <AppText variant="caption" color="textMuted">
              Member since {user ? formatDate(user.createdAt) : '—'}
            </AppText>
          </View>
        </Card>
      </FadeUp>

      {error ? (
        <FadeUp delay={40}>
          <Card tone="alt" style={[styles.notice, { borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" color="danger" style={styles.noticeText}>
              {error}
            </AppText>
          </Card>
        </FadeUp>
      ) : validation ? (
        <FadeUp delay={40}>
          <Card tone="alt" style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
            <AppText variant="caption" color="textMuted" style={styles.noticeText}>
              {validation}
            </AppText>
          </Card>
        </FadeUp>
      ) : null}

      <FadeUp delay={70}>
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          leftIcon="person-outline"
          error={fullName.length > 0 && !nameValid ? 'Enter your full name.' : null}
        />
      </FadeUp>

      <FadeUp delay={100}>
        <View style={styles.fieldGroup}>
          <TextField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            leftIcon="mail-outline"
            error={email.length > 0 && !emailValid ? 'Enter a valid email address.' : null}
            hint="Changing your email means you must verify the new address."
          />
          <View style={styles.statusRow}>
            <Badge
              label={user?.emailVerified ? 'Email verified' : 'Email unverified'}
              tone={user?.emailVerified ? 'success' : 'warning'}
              icon={user?.emailVerified ? 'checkmark-circle' : 'alert-circle-outline'}
              compact
            />
            {emailChanged ? (
              <AppText variant="caption" color="warning">
                New address will need verification
              </AppText>
            ) : null}
          </View>
        </View>
      </FadeUp>

      <FadeUp delay={130}>
        <View style={styles.fieldGroup}>
          <TextField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            leftIcon="call-outline"
            error={phone.length > 0 && !phoneValid ? 'Enter a valid Nigerian phone number.' : null}
            hint="We use this number for receipts and account recovery."
          />
          <View style={styles.statusRow}>
            <Badge
              label={user?.phoneVerified ? 'Phone verified' : 'Phone unverified'}
              tone={user?.phoneVerified ? 'success' : 'warning'}
              icon={user?.phoneVerified ? 'checkmark-circle' : 'alert-circle-outline'}
              compact
            />
            {phoneChanged ? (
              <AppText variant="caption" color="warning">
                New number will need verification
              </AppText>
            ) : null}
          </View>
        </View>
      </FadeUp>

      <FadeUp delay={160}>
        <Card tone="alt">
          <AppText variant="caption" color="textMuted">
            Changing your email or phone number resets its verification status. You will be
            prompted to confirm the new details before they are trusted.
          </AppText>
        </Card>
      </FadeUp>

      <FadeUp delay={190}>
        <Button
          label="Verify contact details"
          variant="secondary"
          icon="ribbon-outline"
          onPress={() => router.push('/verify')}
        />
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noticeText: {
    flex: 1,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
