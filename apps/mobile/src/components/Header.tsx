import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../providers/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from './Text';
import { IconButton } from './IconButton';
import { FadeInView } from './Motion';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
}

export function Header({
  title,
  subtitle,
  eyebrow,
  showBack = false,
  onBack,
  right,
  large = false,
}: HeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <FadeInView style={styles.wrapper}>
      {eyebrow ? (
        <AppText variant="micro" color="accent" style={styles.eyebrow}>
          {eyebrow}
        </AppText>
      ) : null}
      <View style={styles.row}>
        {showBack ? (
          <IconButton
            icon="chevron-back"
            label="Go back"
            tone="default"
            size={22}
            onPress={() => {
              if (onBack) onBack();
              else if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          />
        ) : null}
        <View style={styles.copy}>
          {title ? (
            <AppText variant={large ? 'h1' : 'h3'} numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? (
        <AppText variant="callout" color="textMuted" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      {!showBack && !right && !subtitle ? (
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      ) : null}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 3,
    marginBottom: spacing.xs,
  },
  eyebrow: {
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  copy: {
    flex: 1,
  },
  subtitle: {
    marginTop: -2,
    marginLeft: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
});
