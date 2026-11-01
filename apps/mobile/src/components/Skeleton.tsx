import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../providers/ThemeProvider';
import { radii } from '../theme/tokens';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius = radii.xs, style }: SkeletonProps) {
  const { colors, isDark } = useTheme();
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [shimmer]);

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + shimmer.value * 0.25,
    transform: [{ translateX: shimmer.value * 140 }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { width, height, borderRadius: radius, backgroundColor: colors.skeleton },
        style,
      ]}
    >
      <Animated.View style={[styles.sheen, sheenStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 160,
    left: -160,
  },
});
