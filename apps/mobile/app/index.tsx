import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTheme } from '../src/providers/ThemeProvider';
import { useAuth } from '../src/providers/AuthProvider';
import { BrandMark } from '../src/components/BrandMark';
import { AppText } from '../src/components/Text';

export default function Index() {
  const { status } = useAuth();
  const { colors } = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <BrandMark size={56} />
        <AppText variant="caption" color="textMuted" style={styles.label}>
          Securing your session…
        </AppText>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/(app)/(tabs)' : '/(auth)/welcome'} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  label: {
    marginTop: 4,
  },
});
