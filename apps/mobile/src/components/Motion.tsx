import React from 'react';
import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

/**
 * Springy press feedback. Wrapping the `Pressable` in an `Animated.View` keeps
 * the animated transform independent from the pressable's own style callback,
 * so callers can keep using function styles.
 */
export interface PressableScaleProps extends PressableProps {
  scaleTo?: number;
  wrapperStyle?: StyleProp<ViewStyle>;
}

export function PressableScale({
  scaleTo = 0.975,
  wrapperStyle,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * (1 - scaleTo) }],
  }));

  return (
    <Animated.View style={[wrapperStyle, reduceMotion ? null : animatedStyle]}>
      <Pressable
        {...rest}
        onPressIn={(event) => {
          if (!reduceMotion) {
            progress.value = withSpring(1, { damping: 22, stiffness: 360, mass: 0.7 });
          }
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          if (!reduceMotion) {
            progress.value = withSpring(0, { damping: 20, stiffness: 240, mass: 0.7 });
          }
          onPressOut?.(event);
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export interface FadeUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/** Entrance animation used for cards and sections throughout the app. */
export function FadeUp({
  children,
  delay = 0,
  duration = 560,
  distance = 14,
  style,
}: FadeUpProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <View style={style}>{children}</View>;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay)
        .duration(duration)
        .easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(180)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeInView({ children, delay = 0, style }: FadeInViewProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <View style={style}>{children}</View>;

  return (
    <Animated.View entering={FadeIn.delay(delay).duration(480)} style={style}>
      {children}
    </Animated.View>
  );
}

export function PopIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{children}</>;

  return (
    <Animated.View
      entering={ZoomIn.delay(delay)
        .duration(460)
        .easing(Easing.out(Easing.back(1.4)))}
    >
      {children}
    </Animated.View>
  );
}

/** Layout-animation preset for lists and expanding content. */
export const layoutTransition = {
  duration: 260,
  easing: Easing.out(Easing.cubic),
};

export { Animated, withTiming };
