import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { initials } from '../lib/format';
import { AppText } from './Text';

export interface AvatarProps {
  name: string;
  size?: number;
  tone?: 'primary' | 'accent' | 'neutral';
}

const gradients = {
  primary: ['#14704F', '#0A3F30'] as const,
  accent: ['#C09A5E', '#8A6836'] as const,
  neutral: ['#6B6A60', '#45443C'] as const,
};

export function Avatar({ name, size = 44, tone = 'primary' }: AvatarProps) {
  const stops = gradients[tone];

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      accessible
      accessibilityLabel={`${name} profile`}
    >
      <LinearGradient
        colors={[stops[0], stops[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.ring, { borderRadius: size / 2 }]} />
      <AppText
        serif
        weight="600"
        color="#FBF7EE"
        style={{ fontSize: Math.max(13, size * 0.38), letterSpacing: 0.2 }}
      >
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 247, 238, 0.35)',
  },
});
