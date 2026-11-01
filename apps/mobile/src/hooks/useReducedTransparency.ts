import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the platform "Reduce Transparency" accessibility setting so glass
 * surfaces can fall back to a calm opaque fill instead of blur.
 */
export function useReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (value) => setReduced(value),
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
