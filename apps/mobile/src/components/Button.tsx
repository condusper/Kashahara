import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { glassPalette, hexToRgba, shadeColor } from '../theme/glass';
import { AppText } from './Text';
import { PressableScale } from './Motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Layout styles for the pressable wrapper (alignment, spacing, etc.). */
  wrapperStyle?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const heights: Record<ButtonSize, number> = {
  sm: 44,
  md: 52,
  lg: 58,
};

interface ButtonTone {
  bg: string;
  fg: string;
  border: string;
  gradient?: readonly [string, string];
  highlight?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  wrapperStyle,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const inactive = disabled || loading;
  const glass = glassPalette(isDark, 'thin');

  const tone: Record<ButtonVariant, ButtonTone> = {
    primary: {
      bg: colors.primary,
      fg: colors.onPrimary,
      border: hexToRgba(colors.primary, 0.65),
      gradient: [colors.primary, shadeColor(colors.primary, isDark ? 1.12 : 0.78)],
      highlight: 'rgba(255,255,255,0.32)',
    },
    secondary: {
      bg: glass.fill,
      fg: colors.text,
      border: glass.border,
      highlight: glass.highlight,
    },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: {
      bg: hexToRgba(colors.danger, isDark ? 0.2 : 0.1),
      fg: colors.danger,
      border: hexToRgba(colors.danger, isDark ? 0.4 : 0.28),
      highlight: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.5)',
    },
    gold: {
      bg: colors.accent,
      fg: colors.onAccent,
      border: hexToRgba(colors.accent, 0.65),
      gradient: [colors.accent, shadeColor(colors.accent, 0.78)],
      highlight: 'rgba(255,255,255,0.4)',
    },
    dark: {
      bg: colors.text,
      fg: colors.background,
      border: hexToRgba(colors.text, 0.4),
      gradient: [colors.text, shadeColor(colors.text, 0.88)],
      highlight: 'rgba(255,255,255,0.22)',
    },
  };
  const palette = tone[variant];
  const iconSize = size === 'sm' ? 15 : 18;
  const textVariant = size === 'sm' ? 'callout' : 'bodyStrong';
  const raised = variant === 'primary' || variant === 'gold';

  const handlePress = useCallback(() => {
    if (inactive) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress?.();
  }, [inactive, onPress]);

  return (
    <PressableScale
      testID={testID}
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      wrapperStyle={[fullWidth ? styles.full : styles.auto, wrapperStyle]}
      style={[
        styles.base,
        raised && !inactive ? styles.raised : null,
        {
          minHeight: heights[size],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.45 : 1,
          shadowColor: palette.bg,
        },
        style,
      ]}
    >
      {palette.gradient ? (
        <LinearGradient
          pointerEvents="none"
          colors={palette.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
      ) : null}
      {palette.highlight ? (
        <View
          pointerEvents="none"
          style={[styles.topHighlight, { backgroundColor: palette.highlight }]}
        />
      ) : null}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : icon && iconPosition === 'left' ? (
          <Ionicons name={icon} size={iconSize} color={palette.fg} />
        ) : null}
        <AppText
          variant={textVariant}
          color={palette.fg}
          numberOfLines={1}
          style={styles.label}
        >
          {label}
        </AppText>
        {!loading && icon && iconPosition === 'right' ? (
          <Ionicons name={icon} size={iconSize} color={palette.fg} />
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raised: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 6,
  },
  gradient: {
    borderRadius: radii.pill,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    borderRadius: 1,
  },
  full: {
    width: '100%',
  },
  auto: {
    alignSelf: 'flex-start',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    letterSpacing: -0.15,
  },
});
