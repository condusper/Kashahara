import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { PressableScale } from './Motion';
import { Glass } from './Glass';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: 'surface' | 'alt' | 'strong' | 'primary' | 'accent' | 'dark';
  accessibilityLabel?: string;
  /** Elevation is opt-in so long lists stay flat and calm. */
  elevated?: boolean;
}

/**
 * A Liquid Glass card. The tone maps onto a glass depth and an optional brand
 * tint while every layout style is applied to the inner content so existing
 * screens keep their exact spacing.
 */
export function Card({
  children,
  onPress,
  style,
  padded = true,
  tone = 'surface',
  accessibilityLabel,
  elevated = false,
}: CardProps) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten(style) ?? {};
  const borderColor = typeof flat.borderColor === 'string' ? flat.borderColor : undefined;

  const variant = tone === 'alt' ? 'thin' : tone === 'strong' ? 'thick' : 'regular';
  const tint =
    tone === 'primary'
      ? colors.primary
      : tone === 'accent'
        ? colors.accent
        : tone === 'dark'
          ? colors.text
          : undefined;
  const tintOpacity =
    tone === 'primary' ? 0.1 : tone === 'accent' ? 0.12 : tone === 'dark' ? 0.94 : 0;

  const content = (
    <Glass
      variant={tone === 'dark' ? 'thick' : variant}
      tint={tint}
      tintOpacity={tintOpacity}
      radius={radii.lg}
      shadow={elevated ? 'soft' : 'none'}
      borderColor={borderColor}
      contentStyle={[padded ? styles.padded : null, style]}
    >
      {children}
    </Glass>
  );

  if (!onPress) return content;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.985}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: spacing.lg,
  },
});
