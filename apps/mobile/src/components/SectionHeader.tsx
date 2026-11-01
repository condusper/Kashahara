import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from './Text';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
}

export function SectionHeader({ title, actionLabel, onAction, subtitle }: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <AppText variant="h3">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <AppText variant="callout" color={colors.primary}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
});
