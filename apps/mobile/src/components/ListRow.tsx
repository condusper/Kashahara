import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from './Text';
import { PressableScale } from './Motion';

export interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  right?: React.ReactNode;
  disabled?: boolean;
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  showChevron = Boolean(onPress),
  destructive = false,
  right,
  disabled = false,
}: ListRowProps) {
  const { colors } = useTheme();
  const titleColor = destructive ? colors.danger : colors.text;

  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{ disabled }}
      scaleTo={0.99}
      style={[styles.row, { opacity: disabled ? 0.45 : 1 }]}
    >
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? colors.danger : colors.primary}
          />
        </View>
      ) : null}
      <View style={styles.copy}>
        <AppText variant="bodyStrong" color={titleColor} numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    minHeight: 60,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    letterSpacing: -0.2,
  },
  value: {
    maxWidth: 130,
    textAlign: 'right',
  },
});
