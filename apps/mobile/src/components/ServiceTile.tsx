import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { toneColors } from '../theme/tones';
import { hexToRgba } from '../theme/glass';
import type { Tone } from '../lib/format';
import { AppText } from './Text';
import { PressableScale } from './Motion';
import { Glass } from './Glass';

export interface ServiceTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  tone?: Tone;
  badge?: string;
  onPress: () => void;
  /** Layout styles for the pressable wrapper (used by the parent grid). */
  containerStyle?: StyleProp<ViewStyle>;
}

export function ServiceTile({
  icon,
  label,
  description,
  tone = 'brand',
  badge,
  onPress,
  containerStyle,
}: ServiceTileProps) {
  const { colors, isDark } = useTheme();
  const palette = toneColors(colors, tone);
  const tintFill = hexToRgba(palette.foreground, isDark ? 0.16 : 0.12);

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      scaleTo={0.97}
      wrapperStyle={[styles.wrapper, containerStyle]}
      style={styles.press}
    >
      <Glass
        variant="thin"
        radius={radii.lg}
        shadow="soft"
        style={styles.tile}
        contentStyle={styles.tileContent}
      >
        <View style={styles.top}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: tintFill, borderColor: hexToRgba(palette.foreground, 0.18) },
            ]}
          >
            <Ionicons name={icon} size={22} color={palette.foreground} />
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: tintFill }]}>
              <AppText variant="micro" color={palette.foreground}>
                {badge}
              </AppText>
            </View>
          ) : (
            <View style={[styles.arrow, { backgroundColor: hexToRgba(colors.text, isDark ? 0.08 : 0.05) }]}>
              <Ionicons
                name="arrow-up-outline"
                size={13}
                color={colors.textMuted}
                style={styles.arrowIcon}
              />
            </View>
          )}
        </View>
        <View style={styles.copy}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.label}>
            {label}
          </AppText>
          {description ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {description}
            </AppText>
          ) : null}
        </View>
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 0,
  },
  press: {
    width: '100%',
    minWidth: 0,
  },
  tile: {
    width: '100%',
    minWidth: 0,
  },
  tileContent: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    transform: [{ rotate: '45deg' }],
  },
  copy: {
    gap: 2,
  },
  label: {
    letterSpacing: -0.3,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
