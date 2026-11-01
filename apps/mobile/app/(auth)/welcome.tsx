import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../src/providers/ThemeProvider';
import { Screen } from '../../src/components/Screen';
import { BrandMark } from '../../src/components/BrandMark';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { FadeUp } from '../../src/components/Motion';
import { radii, spacing } from '../../src/theme/tokens';

const features: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'flash-outline',
    title: 'Everyday top-ups',
    body: 'Airtime, data, electricity, TV, and exam PINs in one calm place.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Money you can trace',
    body: 'Every kobo is recorded in an append-only wallet ledger.',
  },
  {
    icon: 'document-text-outline',
    title: 'Receipts that last',
    body: 'Download a clean PNG receipt after every single transaction.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.content}>
      <FadeUp>
        <BrandMark size={38} showWordmark />
      </FadeUp>

      <FadeUp delay={90} style={styles.hero}>
        <AppText variant="display" style={styles.heading}>
          Everything you pay for.{'\n'}One calm wallet.
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.tagline}>
          Kashahara brings airtime, data, bills, and exam PINs together with a wallet you can
          actually understand.
        </AppText>
      </FadeUp>

      <FadeUp delay={170}>
        <WalletArt />
      </FadeUp>

      <FadeUp delay={250} style={styles.features}>
        {features.map((feature, index) => (
          <View key={feature.title}>
            {index > 0 ? (
              <View style={[styles.rule, { backgroundColor: colors.border }]} />
            ) : null}
            <View style={styles.feature}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons name={feature.icon} size={19} color={colors.text} />
              </View>
              <View style={styles.featureCopy}>
                <AppText variant="callout">{feature.title}</AppText>
                <AppText variant="caption" color="textMuted">
                  {feature.body}
                </AppText>
              </View>
            </View>
          </View>
        ))}
      </FadeUp>

      <FadeUp delay={330} style={styles.actions}>
        <Button label="Create your account" onPress={() => router.push('/sign-up')} size="lg" />
        <Button
          label="I already have an account"
          onPress={() => router.push('/sign-in')}
          variant="secondary"
          size="lg"
        />
        <AppText variant="caption" color="textMuted" align="center">
          Protected by a transaction PIN. No card details are stored in the app.
        </AppText>
      </FadeUp>
    </Screen>
  );
}

function WalletArt() {
  const { colors } = useTheme();
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  return (
    <View style={styles.artWrap}>
      <LinearGradient
        colors={['#08261D', '#0C3D2D', '#126A4E']}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.art}
      >
        <View style={styles.artOrbLarge} />
        <View style={styles.artOrbSmall} />
        <View style={styles.artRing} />

        <View style={styles.artTop}>
          <View style={styles.artDot} />
          <AppText variant="micro" color="rgba(251,247,238,0.68)">
            Available balance
          </AppText>
        </View>
        <View style={styles.artBalanceRow}>
          <AppText variant="callout" color="rgba(214,180,120,0.95)" style={styles.artCurrency}>
            ₦
          </AppText>
          <AppText variant="display" color="#FBF7EE" tabular style={styles.artBalance}>
            248,500
          </AppText>
        </View>
        <AppText variant="caption" color="rgba(251,247,238,0.6)">
          NGN · spendable now
        </AppText>

        <View style={styles.artChips}>
          {[
            { icon: 'call-outline' as const, label: 'Airtime' },
            { icon: 'flash-outline' as const, label: 'Power' },
            { icon: 'tv-outline' as const, label: 'TV' },
          ].map((chip) => (
            <View key={chip.label} style={styles.artChip}>
              <Ionicons name={chip.icon} size={13} color="#FBF7EE" />
              <AppText variant="caption" color="#FBF7EE">
                {chip.label}
              </AppText>
            </View>
          ))}
        </View>
      </LinearGradient>

      <Animated.View
        style={[
          styles.floatChip,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
          floatStyle,
        ]}
      >
        <View style={[styles.floatIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
        </View>
        <View style={styles.floatCopy}>
          <AppText variant="caption" color="text">
            Payment complete
          </AppText>
          <AppText variant="micro" color="textMuted">
            Receipt ready
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  hero: {
    gap: spacing.sm,
  },
  heading: {
    maxWidth: 520,
  },
  tagline: {
    maxWidth: 440,
  },
  artWrap: {
    paddingRight: spacing.sm,
  },
  art: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 2,
    overflow: 'hidden',
    minHeight: 196,
    justifyContent: 'center',
  },
  artOrbLarge: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -90,
    top: -120,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  artOrbSmall: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    left: -60,
    bottom: -80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  artRing: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    right: -46,
    top: -78,
  },
  artTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  artDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D6B478',
  },
  artBalanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  artCurrency: {
    marginTop: 12,
    fontSize: 18,
  },
  artBalance: {
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.2,
    marginTop: 4,
  },
  artChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  artChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    height: 30,
    backgroundColor: 'rgba(251,247,238,0.12)',
  },
  floatChip: {
    position: 'absolute',
    right: 0,
    bottom: -16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    paddingHorizontal: 11,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  floatIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatCopy: {
    gap: 0,
  },
  features: {
    gap: 0,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    flex: 1,
    gap: 1,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
