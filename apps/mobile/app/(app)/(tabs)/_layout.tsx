import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { useReducedTransparency } from '../../../src/hooks/useReducedTransparency';
import { glassPalette } from '../../../src/theme/glass';
import { fonts, layout, radii } from '../../../src/theme/tokens';

const icons: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  index: { active: 'home', inactive: 'home-outline' },
  transactions: { active: 'receipt', inactive: 'receipt-outline' },
  wallet: { active: 'wallet', inactive: 'wallet-outline' },
  account: { active: 'person', inactive: 'person-outline' },
};

function TabIcon({
  focused,
  color,
  routeName,
}: {
  focused: boolean;
  color: string;
  routeName: string;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = focused ? 1 : 0;
      return;
    }
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });
  }, [focused, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.value * 1.5 }, { scale: 1 + progress.value * 0.04 }],
  }));

  const icon = icons[routeName] ?? icons.index!;

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        focused ? { backgroundColor: colors.primarySoft } : null,
        animatedStyle,
      ]}
    >
      <Ionicons name={focused ? icon.active : icon.inactive} size={21} color={color} />
      {focused ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
    </Animated.View>
  );
}

/**
 * A glass strip behind the tab bar. The blur is skipped when the platform asks
 * for reduced transparency, where a calm tint keeps the bar readable.
 */
function TabBarBackground() {
  const { colors, isDark } = useTheme();
  const reduceTransparency = useReducedTransparency();
  const glass = glassPalette(isDark, 'thick');

  if (reduceTransparency) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
        ]}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={Platform.OS === 'android' ? 18 : 30}
        tint={glass.blurTint}
        experimentalBlurMethod={
          Platform.OS === 'android' ? 'dimezisBlurView' : undefined
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
      <View pointerEvents="none" style={[styles.topEdge, { backgroundColor: glass.highlight }]} />
      <View pointerEvents="none" style={[styles.topRule, { backgroundColor: glass.border }]} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 10);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => <TabBarBackground />,
        tabBarLabelStyle: {
          fontSize: 10.5,
          lineHeight: 13,
          fontFamily: fonts.semibold,
          letterSpacing: 0.15,
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: layout.tabBarHeight + bottom,
          paddingBottom: bottom,
          paddingTop: 8,
          elevation: 0,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.06,
          shadowRadius: 22,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarIcon: ({ focused, color }) => (
          <TabIcon
            focused={focused}
            color={typeof color === 'string' ? color : colors.textMuted}
            routeName={route.name}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Activity' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: StyleSheet.hairlineWidth * 1.6,
    borderRadius: 1,
    opacity: 0.9,
  },
  topRule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 42,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 3,
    height: 3,
    borderRadius: 2,
  },
});
