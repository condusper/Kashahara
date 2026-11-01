import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { fonts, typography, type TextVariant, type ThemeColors } from '../theme/tokens';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: keyof ThemeColors | string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  /** Render a sans variant in the editorial serif face at the same scale. */
  serif?: boolean;
  /** Use fixed-width figures — useful for money and reference numbers. */
  tabular?: boolean;
  children?: React.ReactNode;
}

/** Custom families ignore `fontWeight`, so weights map to a family instead. */
function familyForWeight(weight: TextStyle['fontWeight']): string | undefined {
  switch (weight) {
    case '800':
    case '900':
      return fonts.heavy;
    case '700':
    case 'bold':
      return fonts.bold;
    case '600':
      return fonts.semibold;
    case '500':
      return fonts.medium;
    case '400':
    case 'normal':
      return fonts.regular;
    default:
      return undefined;
  }
}

function serifFamilyForWeight(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '700':
    case '800':
    case '900':
    case 'bold':
      return fonts.serifBold;
    case '600':
      return fonts.serifSemibold;
    default:
      return fonts.serif;
  }
}

export function AppText({
  variant = 'body',
  color,
  align,
  weight,
  serif = false,
  tabular = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const resolvedColor =
    color && color in colors ? colors[color as keyof ThemeColors] : (color ?? colors.text);
  const family = serif
    ? serifFamilyForWeight(weight)
    : weight
      ? familyForWeight(weight)
      : undefined;

  return (
    <Text
      {...rest}
      style={[
        styles.base,
        typography[variant],
        { color: resolvedColor },
        family ? { fontFamily: family } : null,
        tabular ? styles.tabular : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
