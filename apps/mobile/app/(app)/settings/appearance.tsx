import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ThemeMode } from '../../../src/providers/ThemeProvider';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { Glass } from '../../../src/components/Glass';
import { AppText } from '../../../src/components/Text';
import { PressableScale, FadeUp } from '../../../src/components/Motion';
import { radii, spacing } from '../../../src/theme/tokens';

const options: {
  value: ThemeMode;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Follows your device setting',
    icon: 'phone-portrait-outline',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Warm ivory canvas',
    icon: 'sunny-outline',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Deep forest at night',
    icon: 'moon-outline',
  },
];

const previews = {
  system: { from: '#F7F3EB', to: '#151916', ink: '#0E5A43', line: '#D6CCBA' },
  light: { from: '#F7F3EB', to: '#F1EBDF', ink: '#0E5A43', line: '#D6CCBA' },
  dark: { from: '#151916', to: '#0B0D0C', ink: '#69C7A1', line: '#3A423B' },
} as const;

export default function AppearanceScreen() {
  const { colors, mode, setMode, isDark } = useTheme();

  return (
    <Screen>
      <Header
        showBack
        eyebrow="Preferences"
        title="Appearance"
        subtitle="Choose how Kashahara looks on this device"
      />

      <FadeUp>
        <Card style={styles.previewCard}>
          <View style={styles.previewTop}>
            <View style={styles.previewDots}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <View style={[styles.dot, { backgroundColor: colors.borderStrong }]} />
              <View style={[styles.dot, { backgroundColor: colors.border }]} />
            </View>
            <AppText variant="micro" color="textMuted">
              {isDark ? 'Dark preview' : 'Light preview'}
            </AppText>
          </View>
          <View style={[styles.previewBody, { backgroundColor: colors.background }]}>
            <View style={[styles.previewSurface, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.previewLine, { backgroundColor: colors.borderStrong, width: '46%' }]} />
              <View style={[styles.previewLine, { backgroundColor: colors.border, width: '72%' }]} />
              <View style={[styles.previewPill, { backgroundColor: colors.primarySoft }]}>
                <View style={[styles.previewPillDot, { backgroundColor: colors.primary }]} />
                <View style={[styles.previewLine, { backgroundColor: colors.primary, width: 38, marginBottom: 0 }]} />
              </View>
            </View>
          </View>
          <AppText variant="quote" color="textSecondary" align="center" style={styles.quote}>
            “Quiet, warm, and easy to read — in any light.”
          </AppText>
        </Card>
      </FadeUp>

      <FadeUp delay={70} style={styles.section}>
        <AppText variant="micro" color="textMuted" style={styles.sectionLabel}>
          Theme
        </AppText>
        <View style={styles.options}>
          {options.map((option) => {
            const selected = mode === option.value;
            const preview = previews[option.value];
            return (
              <PressableScale
                key={option.value}
                onPress={() => setMode(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label}. ${option.description}`}
                style={styles.optionPress}
              >
                <Glass
                  variant={selected ? 'regular' : 'thin'}
                  radius={radii.md}
                  tint={selected ? colors.primary : undefined}
                  tintOpacity={0.08}
                  borderColor={selected ? colors.primary : undefined}
                  contentStyle={styles.option}
                >
                  <LinearGradient
                    colors={[preview.from, preview.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.swatch}
                  >
                    <View style={[styles.swatchLine, { backgroundColor: preview.ink, width: 24 }]} />
                    <View style={[styles.swatchLine, { backgroundColor: preview.line, width: 34 }]} />
                    <View style={[styles.swatchDot, { backgroundColor: preview.ink }]} />
                  </LinearGradient>
                  <View style={styles.optionCopy}>
                    <View style={styles.optionTitle}>
                      <Ionicons
                        name={option.icon}
                        size={15}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                      <AppText variant="callout" color={selected ? 'primary' : 'text'}>
                        {option.label}
                      </AppText>
                    </View>
                    <AppText variant="caption" color="textMuted" numberOfLines={2}>
                      {option.description}
                    </AppText>
                  </View>
                  {selected ? (
                    <View style={[styles.check, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                    </View>
                  ) : null}
                </Glass>
              </PressableScale>
            );
          })}
        </View>
      </FadeUp>

      <FadeUp delay={140}>
        <Card tone="alt" style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={styles.noteText}>
            System follows your phone’s light or dark schedule automatically. Your choice is saved on
            this device only.
          </AppText>
        </Card>
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    gap: spacing.md,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewDots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  previewBody: {
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  previewSurface: {
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    gap: 7,
  },
  previewLine: {
    height: 7,
    borderRadius: 4,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
  },
  previewPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  quote: {
    paddingHorizontal: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    marginLeft: 2,
  },
  options: {
    gap: spacing.xs,
  },
  optionPress: {
    width: '100%',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  swatch: {
    width: 62,
    height: 62,
    borderRadius: radii.sm,
    padding: 9,
    justifyContent: 'center',
    gap: 5,
  },
  swatchLine: {
    height: 5,
    borderRadius: 3,
    opacity: 0.9,
  },
  swatchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 1,
    opacity: 0.9,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noteText: {
    flex: 1,
  },
});
