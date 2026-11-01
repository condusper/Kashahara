import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../providers/ThemeProvider';
import { radii, shadows, spacing } from '../theme/tokens';
import { glassPalette } from '../theme/glass';
import { AppText } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
  accessibilityLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { isDark } = useTheme();
  const glass = glassPalette(isDark, 'thin');
  const reduceMotion = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const translateX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[value];
    if (!layout) return;
    if (reduceMotion) {
      translateX.value = layout.x;
      indicatorWidth.value = layout.width;
      return;
    }
    translateX.value = withSpring(layout.x, { damping: 22, stiffness: 260, mass: 0.7 });
    indicatorWidth.value = withTiming(layout.width, { duration: 200 });
  }, [value, layouts, translateX, indicatorWidth, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    transform: [{ translateX: translateX.value }],
  }));

  const content = (
    <View
      style={[
        styles.track,
        {
          backgroundColor: glass.fill,
          borderColor: glass.border,
        },
      ]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.94)' },
          indicatorStyle,
        ]}
      >
        <View style={[styles.indicatorSheen, { backgroundColor: glass.highlight }]} />
      </Animated.View>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              setLayouts((current) =>
                current[option.value]?.x === x && current[option.value]?.width === width
                  ? current
                  : { ...current, [option.value]: { x, width } },
              );
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              option.count === undefined ? option.label : `${option.label}, ${option.count} items`
            }
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.65 : 1 }]}
          >
            <AppText
              variant="caption"
              color={selected ? 'text' : 'textMuted'}
              numberOfLines={1}
              style={styles.label}
            >
              {option.label}
            </AppText>
            {option.count !== undefined ? (
              <View
                style={[
                  styles.count,
                  {
                    backgroundColor: selected
                      ? isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(14,90,67,0.08)'
                      : 'transparent',
                  },
                ]}
              >
                <AppText variant="micro" color={selected ? 'textSecondary' : 'textMuted'}>
                  {option.count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return content;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: shadows.card.shadowOpacity,
    shadowRadius: 6,
    elevation: 2,
  },
  indicatorSheen: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    borderRadius: 1,
    opacity: 0.9,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.xs,
    zIndex: 1,
  },
  label: {
    letterSpacing: -0.1,
  },
  count: {
    minWidth: 18,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
  },
});
