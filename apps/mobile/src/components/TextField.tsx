import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { fonts, radii, spacing } from '../theme/tokens';
import { glassPalette } from '../theme/glass';
import { AppText } from './Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  optional?: boolean;
}

export const TextField = forwardRef<React.ComponentRef<typeof TextInput>, TextFieldProps>(
  function TextField(
    {
      label,
      hint,
      error,
      leftIcon,
      rightIcon,
      onRightPress,
      rightLabel,
      containerStyle,
      optional,
      secureTextEntry,
      style,
      onFocus,
      onBlur,
      multiline,
      ...rest
    },
    ref,
  ) {
    const { colors, isDark } = useTheme();
    const glass = glassPalette(isDark, 'thin');
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const isPassword = Boolean(secureTextEntry);
    const showPasswordToggle = isPassword && !rightIcon;

    const borderColor = error
      ? colors.danger
      : focused
        ? colors.primary
        : glass.border;

    return (
      <View style={[styles.wrapper, containerStyle]}>
        {label ? (
          <View style={styles.labelRow}>
            <AppText variant="caption" color="textSecondary" style={styles.label}>
              {label}
              {optional ? ' · optional' : ''}
            </AppText>
          </View>
        ) : null}
        <View
          style={[
            styles.field,
            {
              backgroundColor: focused ? glass.fillStrong : glass.fill,
              borderColor,
              minHeight: multiline ? 120 : 56,
              shadowColor: colors.primary,
              shadowOpacity: focused ? 0.14 : 0,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.topHighlight, { backgroundColor: glass.highlight }]}
          />
          {leftIcon ? (
            <Ionicons
              name={leftIcon}
              size={18}
              color={focused ? colors.primary : colors.textMuted}
            />
          ) : null}
          <TextInput
            ref={ref}
            {...rest}
            multiline={multiline}
            secureTextEntry={isPassword && !revealed}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={[
              styles.input,
              { color: colors.text },
              multiline ? styles.multiline : null,
              style,
            ]}
            accessibilityLabel={rest.accessibilityLabel ?? label}
          />
          {showPasswordToggle ? (
            <Pressable
              onPress={() => setRevealed((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              hitSlop={10}
              style={styles.accessory}
            >
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={19}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
          {rightIcon ? (
            <Pressable
              onPress={onRightPress}
              accessibilityRole="button"
              accessibilityLabel={rightLabel ?? 'Field action'}
              hitSlop={10}
              style={styles.accessory}
            >
              <Ionicons name={rightIcon} size={19} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <AppText variant="caption" color="danger" style={styles.helper}>
            {error}
          </AppText>
        ) : hint ? (
          <AppText variant="caption" color="textMuted" style={styles.helper}>
            {hint}
          </AppText>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  label: {
    letterSpacing: 0,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 0,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    borderRadius: 1,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
    paddingVertical: spacing.sm,
  },
  multiline: {
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  accessory: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    paddingHorizontal: 2,
  },
});
