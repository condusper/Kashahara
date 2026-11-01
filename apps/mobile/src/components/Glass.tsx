import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../providers/ThemeProvider';
import { useReducedTransparency } from '../hooks/useReducedTransparency';
import { radii } from '../theme/tokens';
import {
  glassPalette,
  glassShadowStyle,
  hexToRgba,
  type GlassShadow,
  type GlassVariant,
} from '../theme/glass';

export interface GlassProps {
  children?: React.ReactNode;
  /** Depth of the glass body. */
  variant?: GlassVariant;
  /** Enable the backdrop blur. Disabled automatically when transparency is reduced. */
  blur?: boolean;
  /** Blur strength for the expo-blur fallback. */
  intensity?: number;
  /** Corner radius shared by the clip and border. */
  radius?: number;
  /** Optional brand tint washed over the glass. */
  tint?: string;
  tintOpacity?: number;
  /** Outer layout / shadow styles. */
  style?: StyleProp<ViewStyle>;
  /** Inner padding / layout styles. */
  contentStyle?: StyleProp<ViewStyle>;
  bordered?: boolean;
  /** Overrides the hairline stroke colour, used by tinted or error surfaces. */
  borderColor?: string;
  highlight?: boolean;
  shadow?: GlassShadow;
  pointerEvents?: ViewProps['pointerEvents'];
  accessibilityLabel?: string;
  accessibilityElementsHidden?: boolean;
}

/**
 * The single Liquid Glass surface used across Kashahara.
 *
 * On iOS 26 the real native glass effect is used through expo-glass-effect.
 * Everywhere else it falls back to expo-blur plus a translucent gradient,
 * edge highlight and hairline stroke. When the platform asks for reduced
 * transparency the surface becomes a calm, opaque material.
 */
export function Glass({
  children,
  variant = 'regular',
  blur = false,
  intensity,
  radius = radii.lg,
  tint,
  tintOpacity = 0.16,
  style,
  contentStyle,
  bordered = true,
  borderColor,
  highlight = true,
  shadow = 'none',
  pointerEvents,
  accessibilityLabel,
  accessibilityElementsHidden,
}: GlassProps) {
  const { colors, isDark } = useTheme();
  const reduceTransparency = useReducedTransparency();
  const palette = glassPalette(isDark, variant);
  const nativeGlass = Platform.OS === 'ios' && isLiquidGlassAvailable() && !reduceTransparency;
  const blurEnabled = blur && !reduceTransparency;

  const shadowStyle = glassShadowStyle(shadow, palette.shadow);
  const fill = reduceTransparency ? colors.surface : palette.fill;
  const edgeColor = borderColor ?? (reduceTransparency ? colors.border : palette.border);
  const blurAmount = intensity ?? (Platform.OS === 'android' ? 18 : 26);

  if (nativeGlass) {
    return (
      <View
        pointerEvents={pointerEvents}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={accessibilityElementsHidden}
        style={[shadowStyle, { borderRadius: radius }, style]}
      >
        <GlassView
          glassEffectStyle={variant === 'clear' ? 'clear' : 'regular'}
          colorScheme={isDark ? 'dark' : 'light'}
          tintColor={tint ? hexToRgba(tint, tintOpacity) : undefined}
          style={[{ borderRadius: radius, overflow: 'hidden' }, contentStyle]}
        >
          {children}
        </GlassView>
        {bordered ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.border,
              { borderRadius: radius, borderColor: edgeColor },
            ]}
          />
        ) : null}
        {highlight ? (
          <View
            pointerEvents="none"
            style={[styles.topHighlight, { backgroundColor: palette.highlight }]}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      pointerEvents={pointerEvents}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={accessibilityElementsHidden}
      style={[shadowStyle, { borderRadius: radius }, style]}
    >
      <View style={[styles.clip, { borderRadius: radius }, contentStyle]}>
        {blurEnabled ? (
          <BlurView
            intensity={blurAmount}
            tint={palette.blurTint}
            experimentalBlurMethod={
              Platform.OS === 'android' ? 'dimezisBlurView' : undefined
            }
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: fill }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[palette.topSheen, 'transparent', palette.bottomSheen]}
          locations={[0, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {tint ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: tint, opacity: reduceTransparency ? tintOpacity * 0.45 : tintOpacity },
            ]}
          />
        ) : null}
        {bordered ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.border,
              { borderRadius: radius, borderColor: edgeColor },
            ]}
          />
        ) : null}
        {highlight ? (
          <View
            pointerEvents="none"
            style={[styles.topHighlight, { backgroundColor: palette.highlight }]}
          />
        ) : null}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    flexGrow: 0,
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: StyleSheet.hairlineWidth * 1.6,
    borderRadius: 1,
    opacity: 0.9,
  },
  content: {
    zIndex: 1,
  },
});
