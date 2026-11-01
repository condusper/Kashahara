import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './Text';
import { Button } from './Button';
import { FadeUp } from './Motion';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'receipt-outline',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors, isDark } = useTheme();

  return (
    <FadeUp style={styles.wrapper}>
      <View style={styles.illustration}>
        <View style={[styles.ring, styles.ringOuter, { borderColor: colors.border }]} />
        <View style={[styles.ring, styles.ringInner, { borderColor: colors.border }]} />
        <LinearGradient
          colors={
            isDark
              ? [colors.surfaceStrong, colors.surfaceAlt]
              : [colors.primarySoft, colors.surfaceAlt]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orb}
        >
          <Ionicons name={icon} size={26} color={colors.primary} />
        </LinearGradient>
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="body" color="textMuted" align="center" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          fullWidth={false}
          style={styles.action}
          wrapperStyle={styles.actionWrapper}
        />
      ) : null}
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  illustration: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ring: {
    position: 'absolute',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ringOuter: {
    width: 104,
    height: 104,
    opacity: 0.7,
  },
  ringInner: {
    width: 78,
    height: 78,
    opacity: 0.9,
  },
  orb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    maxWidth: 300,
  },
  action: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionWrapper: {
    alignSelf: 'center',
  },
});
