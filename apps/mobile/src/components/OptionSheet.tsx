import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText } from './Text';
import { TextField } from './TextField';
import { Sheet } from './Sheet';
import { PressableScale } from './Motion';

export interface SheetOption {
  id: string;
  label: string;
  description?: string;
  meta?: string;
}

export interface OptionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  options: readonly SheetOption[];
  selectedId?: string | null;
  onSelect: (option: SheetOption) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function OptionSheet({
  visible,
  onClose,
  title,
  description,
  options,
  selectedId,
  onSelect,
  searchable = false,
  searchPlaceholder = 'Search',
}: OptionSheetProps) {
  const { colors } = useTheme();
  const [query, setQuery] = React.useState('');

  const close = () => {
    setQuery('');
    onClose();
  };

  const filtered = query.trim()
    ? options.filter((option) => {
        const needle = query.trim().toLowerCase();
        return (
          option.label.toLowerCase().includes(needle) ||
          (option.description ?? '').toLowerCase().includes(needle) ||
          (option.meta ?? '').toLowerCase().includes(needle)
        );
      })
    : options;

  return (
    <Sheet visible={visible} onClose={close} title={title} description={description}>
      {searchable ? (
        <TextField
          placeholder={searchPlaceholder}
          value={query}
          onChangeText={setQuery}
          leftIcon="search-outline"
          autoCorrect={false}
          returnKeyType="search"
        />
      ) : null}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="caption" color="textMuted">
              No matching options.
            </AppText>
          </View>
        ) : (
          filtered.map((option, index) => {
            const selected = option.id === selectedId;
            return (
              <View key={option.id}>
                {index > 0 ? (
                  <View style={[styles.rule, { backgroundColor: colors.border }]} />
                ) : null}
                <PressableScale
                  onPress={() => {
                    onSelect(option);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  scaleTo={0.99}
                  style={styles.option}
                >
                  <View style={styles.optionCopy}>
                    <AppText
                      variant="bodyStrong"
                      color={selected ? 'primary' : 'text'}
                      numberOfLines={1}
                    >
                      {option.label}
                    </AppText>
                    {option.description ? (
                      <AppText variant="caption" color="textMuted" numberOfLines={2}>
                        {option.description}
                      </AppText>
                    ) : null}
                  </View>
                  {option.meta ? (
                    <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                      {option.meta}
                    </AppText>
                  ) : null}
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </PressableScale>
              </View>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 440,
    marginTop: spacing.xxs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    minHeight: 52,
  },
  optionCopy: {
    flex: 1,
    gap: 1,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
