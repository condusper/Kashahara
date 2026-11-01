import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { radii } from '../theme/tokens';
import { toneColors } from '../theme/tones';
import type { Tone } from '../lib/format';
import { AppText } from './Text';

export interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  dot?: boolean;
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
  style,
  compact,
  dot = false,
}: BadgeProps) {
  const { colors } = useTheme();
  const palette = toneColors(colors, tone);

  return (
    <View
      style={[
        styles.base,
        compact ? styles.compact : null,
        { backgroundColor: palette.background },
        style,
      ]}
    >
      {dot ? (
        <View style={[styles.dot, { backgroundColor: palette.foreground }]} />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 10 : 12} color={palette.foreground} />
      ) : null}
      <AppText
        variant="caption"
        color={palette.foreground}
        numberOfLines={1}
        style={[styles.label, compact ? styles.compactLabel : null]}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  compact: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    lineHeight: 15,
  },
  compactLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
