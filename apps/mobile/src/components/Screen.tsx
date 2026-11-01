import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../providers/ThemeProvider';
import { layout, spacing } from '../theme/tokens';
import { AmbientBackground } from './AmbientBackground';
import { Glass } from './Glass';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  edges?: readonly Edge[];
  refreshControl?: React.ReactElement;
  keyboardOffset?: number;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
  contentStyle,
  style,
  edges = ['top', 'left', 'right'],
  refreshControl,
  keyboardOffset = 0,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      contentContainerStyle={[
        styles.content,
        padded ? styles.padded : null,
        footer ? styles.withFooter : null,
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, padded ? styles.padded : null, contentStyle]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, style]}>
      <AmbientBackground />
      <SafeAreaView edges={edges} style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardOffset}
        >
          <View style={styles.fill}>
            {body}
            {footer ? (
              <Glass
                variant="thick"
                blur
                radius={0}
                bordered={false}
                contentStyle={[
                  styles.footer,
                  { paddingBottom: Math.max(insets.bottom, spacing.sm) },
                ]}
              >
                {footer}
              </Glass>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.md,
  },
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  withFooter: {
    paddingBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
});
