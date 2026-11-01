import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../providers/ThemeProvider';
import { formatKobo } from '../lib/format';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './Text';
import { Button } from './Button';
import { Keypad } from './Keypad';
import { PressableScale } from './Motion';

export interface AmountPadProps {
  valueKobo: number;
  onChange: (kobo: number) => void;
  presets?: readonly number[];
  minKobo?: number;
  maxKobo?: number;
  helper?: string;
  submitLabel?: string;
  onSubmit?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function AmountPad({
  valueKobo,
  onChange,
  presets = [],
  minKobo = 10_000,
  maxKobo = 50_000_000,
  helper,
  submitLabel = 'Continue',
  onSubmit,
  loading = false,
  disabled = false,
}: AmountPadProps) {
  const { colors } = useTheme();
  // The amount is controlled by the parent. Derive the digit string from
  // `valueKobo` instead of mirroring it in state so external updates such as
  // presets apply without an effect.
  const raw = valueKobo > 0 ? String(Math.floor(valueKobo / 100)) : '';
  const pop = useSharedValue(1);

  useEffect(() => {
    pop.value = withSequence(
      withTiming(0.965, { duration: 70 }),
      withSpring(1, { damping: 14, stiffness: 320 }),
    );
  }, [valueKobo, pop]);

  const amountStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const commit = (nextRaw: string) => {
    const digits = nextRaw.replace(/^0+(?=\d)/, '');
    const kobo = digits ? Number(digits) * 100 : 0;
    if (kobo > maxKobo) return;
    onChange(kobo);
  };

  const append = (digit: string) => {
    if (loading) return;
    commit(`${raw}${digit}`);
  };

  const remove = () => {
    if (loading) return;
    commit(raw.slice(0, -1));
  };

  const tooLow = valueKobo > 0 && valueKobo < minKobo;
  const tooHigh = valueKobo > maxKobo;
  const valid = valueKobo >= minKobo && valueKobo <= maxKobo;
  const canSubmit = valid && !disabled && !loading;

  return (
    <View style={styles.wrapper}>
      <View style={styles.display}>
        <AppText variant="micro" color="textMuted">
          Amount
        </AppText>
        <Animated.View style={[styles.amountRow, amountStyle]}>
          <AppText
            variant="h3"
            color={valueKobo > 0 ? 'accent' : 'textMuted'}
            style={styles.currency}
          >
            ₦
          </AppText>
          <AppText
            variant="display"
            color={valueKobo > 0 ? 'text' : 'textMuted'}
            style={styles.amount}
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatKobo(valueKobo, { decimals: false }).replace('₦', '')}
          </AppText>
        </Animated.View>
        <View style={styles.helperRow}>
          {tooLow ? (
            <AppText variant="caption" color="danger">
              Minimum is {formatKobo(minKobo, { decimals: false })}
            </AppText>
          ) : tooHigh ? (
            <AppText variant="caption" color="danger">
              Maximum is {formatKobo(maxKobo, { decimals: false })}
            </AppText>
          ) : helper ? (
            <AppText variant="caption" color="textMuted" align="center">
              {helper}
            </AppText>
          ) : null}
        </View>
      </View>

      {presets.length > 0 ? (
        <View style={styles.presets}>
          {presets.map((preset) => {
            const selected = valueKobo === preset;
            return (
              <PressableScale
                key={preset}
                onPress={() => commit(String(Math.floor(preset / 100)))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Set amount to ${formatKobo(preset, { decimals: false })}`}
                scaleTo={0.94}
                wrapperStyle={styles.presetWrapper}
                style={[
                  styles.preset,
                  {
                    backgroundColor: selected
                      ? colors.primary
                      : colors.surfaceAlt,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color={selected ? 'onPrimary' : 'textSecondary'}
                  numberOfLines={1}
                >
                  {formatKobo(preset, { decimals: false })}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      <Keypad onDigit={append} onBackspace={remove} disabled={loading} />

      {onSubmit ? (
        <Button
          label={submitLabel}
          onPress={onSubmit}
          loading={loading}
          disabled={!canSubmit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  display: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  currency: {
    marginTop: 12,
    fontSize: 20,
  },
  amount: {
    flexShrink: 1,
    fontSize: 46,
    lineHeight: 54,
    letterSpacing: -1.4,
  },
  helperRow: {
    minHeight: 18,
    justifyContent: 'center',
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  presetWrapper: {
    flexGrow: 1,
    flexBasis: '22%',
  },
  preset: {
    height: 38,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
