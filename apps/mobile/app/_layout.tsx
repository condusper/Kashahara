import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ThemeProvider, useTheme } from '../src/providers/ThemeProvider';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { ToastProvider } from '../src/providers/ToastProvider';
import { ReceiptProvider } from '../src/providers/ReceiptProvider';

const fontAssets = {
  'SFProText-Regular': require('../assets/fonts/SFProText-Regular.otf'),
  'SFProText-Medium': require('../assets/fonts/SFProText-Medium.otf'),
  'SFProText-Semibold': require('../assets/fonts/SFProText-Semibold.otf'),
  'SFProText-Bold': require('../assets/fonts/SFProText-Bold.otf'),
  'SFProText-Heavy': require('../assets/fonts/SFProText-Heavy.otf'),
  'SFProDisplay-Regular': require('../assets/fonts/SFProDisplay-Regular.otf'),
  'SFProDisplay-Semibold': require('../assets/fonts/SFProDisplay-Semibold.otf'),
  'SFProDisplay-Bold': require('../assets/fonts/SFProDisplay-Bold.otf'),
  'SFProDisplay-RegularItalic': require('../assets/fonts/SFProDisplay-RegularItalic.otf'),
};

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be hidden during fast refresh.
});

function RootNavigator() {
  const { colors, isDark } = useTheme();
  const { status } = useAuth();
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  const ready = (fontsLoaded || Boolean(fontError)) && status !== 'loading';

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ReceiptProvider>
              <RootNavigator />
            </ReceiptProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
