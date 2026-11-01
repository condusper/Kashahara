import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { useTheme } from '../../src/providers/ThemeProvider';
import { BrandMark } from '../../src/components/BrandMark';
import { AppText } from '../../src/components/Text';

export default function AppLayout() {
  const { status } = useAuth();
  const { colors } = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <BrandMark size={52} />
        <ActivityIndicator color={colors.primary} />
        <AppText variant="caption" color="textMuted">
          Opening your wallet…
        </AppText>
      </View>
    );
  }

  if (status === 'guest') {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
});
