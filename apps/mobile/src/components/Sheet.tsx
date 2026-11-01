import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './Text';
import { Glass } from './Glass';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissable?: boolean;
}

export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  dismissable = true,
}: SheetProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (dismissable) onClose();
      }}
    >
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(220)} style={styles.backdrop}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={16}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={dismissable ? onClose : undefined}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(180)}
            style={[styles.sheet, { marginBottom: Math.max(insets.bottom, spacing.xs) }]}
          >
            <Glass
              variant="thick"
              blur
              radius={radii.xxl}
              shadow="floating"
              contentStyle={styles.sheetContent}
            >
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              {title ? (
                <View style={styles.heading}>
                  <View style={styles.headingCopy}>
                    <AppText variant="h2">{title}</AppText>
                    {description ? (
                      <AppText variant="callout" color="textMuted">
                        {description}
                      </AppText>
                    ) : null}
                  </View>
                  {dismissable ? (
                    <Pressable
                      onPress={onClose}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      hitSlop={10}
                      style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
                    >
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.body}>{children}</View>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </Glass>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  keyboard: {
    width: '100%',
    maxHeight: '94%',
  },
  sheet: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: spacing.md,
    opacity: 0.6,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headingCopy: {
    flex: 1,
    gap: 2,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  body: {
    gap: spacing.sm,
  },
  footer: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
});
