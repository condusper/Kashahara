import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { layout, radii } from '../theme/tokens';
import { PressableScale } from './Motion';
import { Glass } from './Glass';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: 'default' | 'primary' | 'danger' | 'plain' | 'inverse';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 20,
  tone = 'default',
  disabled,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const foreground =
    tone === 'primary'
      ? colors.primary
      : tone === 'danger'
        ? colors.danger
        : tone === 'inverse'
          ? colors.onPrimary
          : colors.text;
  const tint =
    tone === 'primary'
      ? colors.primary
      : tone === 'danger'
        ? colors.danger
        : tone === 'inverse'
          ? '#FFFFFF'
          : undefined;

  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={6}
      wrapperStyle={styles.wrapper}
      style={[
        styles.base,
        tone === 'plain' ? styles.plain : null,
        { opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      {tone !== 'plain' ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Glass
            variant="thin"
            radius={radii.pill}
            tint={tint}
            tintOpacity={tone === 'inverse' ? 0.18 : 0.12}
            blur
            style={styles.fill}
          />
        </View>
      ) : null}
      <Ionicons name={icon} size={size} color={foreground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  base: {
    width: layout.touchTarget - 4,
    height: layout.touchTarget - 4,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    width: layout.touchTarget - 4,
    height: layout.touchTarget - 4,
    marginLeft: -8,
  },
  fill: {
    flex: 1,
  },
});
