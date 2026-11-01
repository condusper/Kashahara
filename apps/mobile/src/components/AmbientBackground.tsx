import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../providers/ThemeProvider';

/**
 * A soft, living canvas behind every screen. Three oversized light blooms give
 * the glass surfaces something to refract without compromising text contrast.
 */
export function AmbientBackground() {
  const { colors, isDark } = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={
          isDark
            ? ['#070B09', '#09110D', '#0A0D0C']
            : ['#FCF9F3', '#F4F1E9', '#EDF2EE']
        }
        locations={[0, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[
          isDark ? 'rgba(47, 224, 160, 0.18)' : 'rgba(17, 112, 78, 0.16)',
          'transparent',
        ]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bloom, styles.emeraldBloom]}
      />
      <LinearGradient
        colors={[
          isDark ? 'rgba(96, 165, 250, 0.13)' : 'rgba(74, 139, 184, 0.13)',
          'transparent',
        ]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        style={[styles.bloom, styles.skyBloom]}
      />
      <LinearGradient
        colors={[
          isDark ? 'rgba(214, 180, 120, 0.11)' : 'rgba(168, 129, 74, 0.13)',
          'transparent',
        ]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bloom, styles.bronzeBloom]}
      />

      <LinearGradient
        colors={
          isDark
            ? ['rgba(255,255,255,0.045)', 'transparent']
            : ['rgba(255,255,255,0.55)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bloom: {
    position: 'absolute',
    borderRadius: 999,
  },
  emeraldBloom: {
    width: 460,
    height: 460,
    right: '-34%',
    top: '-16%',
  },
  skyBloom: {
    width: 400,
    height: 400,
    left: '-42%',
    top: '30%',
  },
  bronzeBloom: {
    width: 430,
    height: 430,
    right: '-38%',
    bottom: '-18%',
  },
});
