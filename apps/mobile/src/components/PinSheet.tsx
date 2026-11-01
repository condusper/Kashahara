import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './Text';
import { Button } from './Button';
import { Keypad } from './Keypad';
import { Sheet } from './Sheet';

export interface PinSheetSummaryRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface PinSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  onForgot?: () => void;
  title?: string;
  description?: string;
  summary?: readonly PinSheetSummaryRow[];
  error?: string | null;
  loading?: boolean;
  pinLength?: number;
}

export function PinSheet({
  visible,
  onClose,
  onConfirm,
  onForgot,
  title = 'Enter transaction PIN',
  description = 'Your PIN authorises this transaction. It is never stored on this device.',
  summary,
  error,
  loading = false,
  pinLength = 4,
}: PinSheetProps) {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const shake = useSharedValue(0);
  const previousError = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== previousError.current) {
      shake.value = withSequence(
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 55 }),
        withTiming(-6, { duration: 55 }),
        withTiming(6, { duration: 55 }),
        withSpring(0, { damping: 14, stiffness: 260 }),
      );
    }
    previousError.current = error ?? null;
  }, [error, shake]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const close = () => {
    setPin('');
    onClose();
  };

  const confirm = () => {
    // Clear immediately so a rejected PIN is never left in the keypad after
    // the error is shown. The parent decides whether the sheet stays open.
    setPin('');
    onConfirm(pin);
  };

  const append = (digit: string) => {
    if (loading) return;
    setPin((current) => (current.length >= pinLength ? current : `${current}${digit}`));
  };

  const remove = () => {
    if (loading) return;
    setPin((current) => current.slice(0, -1));
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={title}
      description={description}
      dismissable={!loading}
      footer={
        <>
          <Button
            label="Confirm purchase"
            onPress={confirm}
            loading={loading}
            disabled={pin.length !== pinLength}
          />
          {onForgot ? (
            <Pressable
              onPress={onForgot}
              accessibilityRole="button"
              accessibilityLabel="Reset transaction PIN"
              style={styles.forgot}
            >
              <AppText variant="caption" color="primary">
                Forgot your PIN?
              </AppText>
            </Pressable>
          ) : null}
        </>
      }
    >
      <Animated.View style={[styles.dots, shakeStyle]}>
        {Array.from({ length: pinLength }).map((_, index) => (
          <PinDot key={index} filled={index < pin.length} invalid={Boolean(error)} />
        ))}
      </Animated.View>
      {summary && summary.length > 0 ? (
        <View style={[styles.summary, { borderColor: colors.border }]}>
          {summary.map((row) => (
            <View key={row.label} style={styles.summaryRow}>
              <AppText
                variant={row.emphasis ? 'bodyStrong' : 'caption'}
                color={row.emphasis ? 'text' : 'textMuted'}
              >
                {row.label}
              </AppText>
              <AppText
                variant={row.emphasis ? 'bodyStrong' : 'caption'}
                color={row.emphasis ? 'text' : 'textSecondary'}
                tabular
              >
                {row.value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      <AppText
        variant="caption"
        color={error ? 'danger' : 'textMuted'}
        align="center"
        accessibilityLiveRegion="polite"
      >
        {error
          ? error
          : pin.length === pinLength
            ? 'Tap confirm to continue.'
            : 'Enter your 4-digit PIN.'}
      </AppText>
      <View style={styles.keypad}>
        <Keypad onDigit={append} onBackspace={remove} disabled={loading} />
      </View>
    </Sheet>
  );
}

function PinDot({ filled, invalid }: { filled: boolean; invalid: boolean }) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.72);

  useEffect(() => {
    scale.value = withSpring(filled ? 1 : 0.72, { damping: 14, stiffness: 380 });
  }, [filled, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          borderColor: invalid ? colors.danger : filled ? colors.primary : colors.borderStrong,
          backgroundColor: invalid
            ? colors.danger
            : filled
              ? colors.primary
              : 'transparent',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  keypad: {
    marginTop: spacing.xs,
  },
  forgot: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
});
