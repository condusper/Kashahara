import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Smoothly animates a numeric value. Used for the wallet balance so a change
 * feels like money settling rather than text being replaced.
 */
export function useCountUp(value: number, duration = 900): number {
  const [animated] = useState(() => new Animated.Value(value));
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const listener = animated.addListener(({ value: next }) => {
      setDisplay(Math.round(next));
    });
    Animated.timing(animated, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      animated.removeListener(listener);
    };
  }, [animated, duration, value]);

  return display;
}
