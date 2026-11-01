import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/providers/ThemeProvider';
import { getStoredItem, setStoredItem, storageKeys } from '../../../src/lib/storage';
import { Screen } from '../../../src/components/Screen';
import { Header } from '../../../src/components/Header';
import { Card } from '../../../src/components/Card';
import { AppText } from '../../../src/components/Text';
import { FadeUp } from '../../../src/components/Motion';
import { spacing } from '../../../src/theme/tokens';

type PrefKey = 'transactions' | 'security' | 'product';

const definitions: {
  key: PrefKey;
  storageKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}[] = [
  {
    key: 'transactions',
    storageKey: storageKeys.notifyTransactions,
    icon: 'receipt-outline',
    title: 'Payment receipts',
    description: 'A quiet confirmation whenever a purchase or top-up completes.',
  },
  {
    key: 'security',
    storageKey: storageKeys.notifySecurity,
    icon: 'shield-checkmark-outline',
    title: 'Security alerts',
    description: 'New sign-ins, PIN changes, and password updates.',
  },
  {
    key: 'product',
    storageKey: storageKeys.notifyProduct,
    icon: 'sparkles-outline',
    title: 'Product updates',
    description: 'Occasional notes about new services and improvements.',
  },
];

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    transactions: true,
    security: true,
    product: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(
        definitions.map(async (definition) => {
          const stored = await getStoredItem(definition.storageKey);
          return [definition.key, stored === null ? undefined : stored === 'true'] as const;
        }),
      );
      if (!active) return;
      setPrefs((current) => {
        const next = { ...current };
        for (const [key, value] of entries) {
          if (value !== undefined) next[key] = value;
        }
        return next;
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = (key: PrefKey, value: boolean) => {
    setPrefs((current) => ({ ...current, [key]: value }));
    const definition = definitions.find((item) => item.key === key);
    if (definition) void setStoredItem(definition.storageKey, String(value));
  };

  return (
    <Screen>
      <Header
        showBack
        eyebrow="Preferences"
        title="Notifications"
        subtitle="Choose what deserves your attention"
      />

      <FadeUp>
        <Card style={styles.list}>
          {definitions.map((definition, index) => (
            <View key={definition.key}>
              {index > 0 ? (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={definition.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.copy}>
                  <AppText variant="bodyStrong">{definition.title}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {definition.description}
                  </AppText>
                </View>
                <Switch
                  value={prefs[definition.key]}
                  onValueChange={(value) => toggle(definition.key, value)}
                  trackColor={{ false: colors.surfaceStrong, true: colors.primary }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.surfaceStrong}
                  accessibilityLabel={definition.title}
                />
              </View>
            </View>
          ))}
        </Card>
      </FadeUp>

      <FadeUp delay={80}>
        <Card tone="alt" style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={styles.noteText}>
            These preferences are saved on this device. System notifications also depend on your
            phone’s settings for Kashahara. Receipts are always available in Activity.
          </AppText>
        </Card>
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: 2,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 68,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
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
