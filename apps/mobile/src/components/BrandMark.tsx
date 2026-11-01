import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../theme/tokens';
import { AppText } from './Text';

export interface BrandMarkProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * The Kashahara mark: a deep emerald squircle, hairline bronze edge and an
 * editorial serif K. It is drawn with plain views and a gradient so it stays
 * crisp at every size and needs no image assets.
 */
export function BrandMark({ size = 40, showWordmark = false }: BrandMarkProps) {
  return (
    <View style={styles.row} accessibilityLabel="Kashahara">
      <LinearGradient
        colors={['#0A3F30', '#0E5A43', '#14704F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderRadius: size * 0.31,
          },
        ]}
      >
        <View style={[styles.sheen, { borderRadius: size * 0.31 }]} />
        <AppText
          color="#FBF7EE"
          style={{
            fontFamily: fonts.serifSemibold,
            fontSize: size * 0.62,
            lineHeight: size * 0.74,
            letterSpacing: -0.5,
          }}
        >
          K
        </AppText>
      </LinearGradient>
      {showWordmark ? (
        <AppText variant="h3" style={styles.wordmark}>
          Kashahara
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214, 180, 120, 0.55)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  wordmark: {
    letterSpacing: -0.4,
  },
});
