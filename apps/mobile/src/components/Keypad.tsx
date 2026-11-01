import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './Text';
import { PressableScale } from './Motion';

export interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  showZero?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Keypad({ onDigit, onBackspace, disabled = false }: KeypadProps) {
  const { colors } = useTheme();

  const press = (digit: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onDigit(digit);
  };

  const keyBackground = colors.surfaceAlt;

  const renderKey = (key: string) => (
    <PressableScale
      key={key}
      onPress={() => press(key)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={key}
      scaleTo={0.94}
      wrapperStyle={styles.keyWrapper}
      style={[styles.key, { backgroundColor: keyBackground, opacity: disabled ? 0.45 : 1 }]}
    >
      <AppText variant="h3" style={styles.keyLabel}>
        {key}
      </AppText>
    </PressableScale>
  );

  return (
    <View style={styles.grid}>
      {KEYS.map(renderKey)}
      <View style={styles.keyWrapper} />
      {renderKey('0')}
      <PressableScale
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          onBackspace();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Delete last digit"
        scaleTo={0.94}
        wrapperStyle={styles.keyWrapper}
        style={[styles.key, styles.ghostKey, { opacity: disabled ? 0.45 : 1 }]}
      >
        <Ionicons name="backspace-outline" size={23} color={colors.textSecondary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.xs,
  },
  keyWrapper: {
    width: '31.5%',
  },
  key: {
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostKey: {
    backgroundColor: 'transparent',
  },
  keyLabel: {
    fontSize: 23,
    letterSpacing: 0,
  },
});
