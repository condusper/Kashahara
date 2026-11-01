import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../providers/ThemeProvider';
import { useReducedTransparency } from '../hooks/useReducedTransparency';
import { formatKobo } from '../lib/format';
import { useCountUp } from '../hooks/useCountUp';
import { radii, shadows, spacing } from '../theme/tokens';
import { hexToRgba } from '../theme/glass';
import { AppText } from './Text';

export interface BalanceCardProps {
  balanceKobo: number;
  onAddMoney: () => void;
  onViewWallet?: () => void;
  /** Kept for API compatibility; the interface no longer advertises demos. */
  simulated?: boolean;
}

export function BalanceCard({
  balanceKobo,
  onAddMoney,
  onViewWallet,
}: BalanceCardProps) {
  const { colors, isDark } = useTheme();
  const reduceTransparency = useReducedTransparency();
  const reduceMotion = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const animatedBalance = useCountUp(balanceKobo);
  const sheen = useSharedValue(-1);

  useEffect(() => {
    if (reduceMotion) return;
    sheen.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 6200 }),
        ),
        -1,
        false,
      ),
    );
  }, [sheen, reduceMotion]);

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.4,
    transform: [{ translateX: sheen.value * 460 }, { rotate: '16deg' }],
  }));

  const ink = colors.heroInk;

  return (
    <View style={[styles.wrapper, isDark ? styles.wrapperDark : null]}>
      <View style={styles.card}>
        {!reduceTransparency ? (
          <BlurView
            intensity={Platform.OS === 'android' ? 16 : 22}
            tint="dark"
            experimentalBlurMethod={
              Platform.OS === 'android' ? 'dimezisBlurView' : undefined
            }
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          colors={
            reduceTransparency
              ? [colors.heroFrom, colors.heroMid, colors.heroTo]
              : [
                  hexToRgba(colors.heroFrom, 0.94),
                  hexToRgba(colors.heroMid, 0.84),
                  hexToRgba(colors.heroTo, 0.72),
                ]
          }
          start={{ x: 0.05, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View pointerEvents="none" style={styles.art}>
          <View style={[styles.orb, styles.orbLarge]} />
          <View style={[styles.orb, styles.orbSmall]} />
          <View style={styles.ring} />
          <View style={styles.goldArc} />
          <Animated.View style={[styles.sheen, sheenStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.14)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <LinearGradient
            colors={['rgba(255,255,255,0.16)', 'transparent', 'rgba(255,255,255,0.03)']}
            locations={[0, 0.46, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.rim} />
          <View style={styles.topEdge} />
        </View>

        <View style={styles.topRow}>
          <View style={styles.labelRow}>
            <View style={styles.liveDot} />
            <AppText variant="micro" color="rgba(251,247,238,0.7)">
              Available balance
            </AppText>
          </View>
          <Pressable
            onPress={() => setHidden((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
            hitSlop={10}
            style={({ pressed }) => [
              styles.eye,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={17}
              color="rgba(251,247,238,0.9)"
            />
          </Pressable>
        </View>

        <View style={styles.balanceRow}>
          <AppText variant="callout" color="rgba(214,180,120,0.98)" style={styles.currency}>
            ₦
          </AppText>
          <AppText
            variant="display"
            color={ink}
            tabular
            style={styles.balance}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.62}
          >
            {hidden ? '••••••' : formatKobo(animatedBalance).replace('₦', '')}
          </AppText>
        </View>

        <AppText variant="caption" color="rgba(251,247,238,0.6)" style={styles.currencyNote}>
          NGN · spendable now
        </AppText>

        <View style={styles.actions}>
          <Pressable
            onPress={onAddMoney}
            accessibilityRole="button"
            accessibilityLabel="Add money to wallet"
            style={({ pressed }) => [
              styles.primaryAction,
              { transform: [{ scale: pressed ? 0.975 : 1 }] },
            ]}
          >
            <Ionicons name="add" size={17} color={colors.primaryPressed} />
            <AppText variant="callout" color={colors.primaryPressed} style={styles.actionLabel}>
              Add money
            </AppText>
          </Pressable>
          {onViewWallet ? (
            <Pressable
              onPress={onViewWallet}
              accessibilityRole="button"
              accessibilityLabel="View wallet"
              style={({ pressed }) => [
                styles.ghostAction,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Ionicons name="wallet-outline" size={16} color={ink} />
              <AppText variant="callout" color={ink} style={styles.actionLabel}>
                Wallet
              </AppText>
              <Ionicons name="arrow-forward" size={14} color="rgba(251,247,238,0.8)" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.xl,
    ...shadows.hero,
  },
  wrapperDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.55,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,180,120,0.32)',
  },
  art: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(251,247,238,0.08)',
  },
  orbLarge: {
    width: 260,
    height: 260,
    right: -90,
    top: -120,
  },
  orbSmall: {
    width: 150,
    height: 150,
    left: -56,
    bottom: -76,
    backgroundColor: 'rgba(251,247,238,0.06)',
  },
  ring: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,247,238,0.18)',
    right: -46,
    top: -76,
  },
  goldArc: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,180,120,0.4)',
    right: -10,
    bottom: -96,
  },
  rim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 1,
  },
  sheen: {
    position: 'absolute',
    top: -90,
    bottom: -90,
    width: 110,
    left: '8%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D6B478',
    shadowColor: '#D6B478',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  eye: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(251,247,238,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    gap: 4,
  },
  currency: {
    marginTop: 12,
    fontSize: 19,
  },
  balance: {
    flexShrink: 1,
    fontSize: 50,
    lineHeight: 54,
    letterSpacing: -0.8,
  },
  currencyNote: {
    marginTop: 2,
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FBF7EE',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 42,
    shadowColor: '#041A13',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  actionLabel: {
    letterSpacing: -0.2,
  },
  ghostAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,247,238,0.3)',
    backgroundColor: 'rgba(251,247,238,0.1)',
    paddingHorizontal: spacing.md,
    height: 42,
  },
});
