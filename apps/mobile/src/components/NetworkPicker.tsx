import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NetworkOption } from '@kashahara/shared';
import { useTheme } from '../providers/ThemeProvider';
import { radii, spacing } from '../theme/tokens';
import { AppText } from './Text';
import { PressableScale } from './Motion';

export interface NetworkPickerProps {
  networks: readonly NetworkOption[];
  value: string | null;
  onChange: (network: NetworkOption) => void;
  label?: string;
}

export function NetworkPicker({
  networks,
  value,
  onChange,
  label = 'Network',
}: NetworkPickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {networks.map((network) => {
          const selected = network.id === value;
          return (
            <PressableScale
              key={network.id}
              onPress={() => onChange(network)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={network.name}
              scaleTo={0.95}
              style={[
                styles.item,
                {
                  backgroundColor: selected ? colors.surface : colors.surfaceAlt,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: network.color,
                    borderColor: colors.border,
                  },
                ]}
              />
              <AppText
                variant="callout"
                color={selected ? 'text' : 'textSecondary'}
                numberOfLines={1}
              >
                {network.shortName}
              </AppText>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  row: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
