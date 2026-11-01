/**
 * Local development helper.
 *
 * The default dev server asks Metro to precompile the launch bundle to Hermes
 * bytecode. Some sandboxed environments cannot run the bundled `hermesc`
 * binary. Setting KASHARAHA_DEV_PLAIN_JS=1 serves plain JavaScript instead;
 * Hermes, JSC and Expo Go all execute it normally. Production builds are
 * unaffected and keep the Hermes engine.
 */
const plainJs = process.env.KASHARAHA_DEV_PLAIN_JS === '1';

module.exports = {
  expo: {
    name: 'Kashahara',
    slug: 'kashahara',
    version: '0.1.0',
    scheme: 'kashahara',
    orientation: 'default',
    userInterfaceStyle: 'automatic',
    icon: './assets/images/icon.png',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.kashahara.app',
      buildNumber: '1',
      icon: './assets/images/icon.png',
    },
    android: {
      package: 'com.kashahara.app',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#0E5A43',
        foregroundImage: './assets/images/adaptive-icon.png',
        monochromeImage: './assets/images/adaptive-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: true,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#F7F3EB',
          image: './assets/images/splash-icon.png',
          imageWidth: 160,
          dark: {
            backgroundColor: '#0B0D0C',
            image: './assets/images/splash-icon.png',
            imageWidth: 160,
          },
        },
      ],
      'expo-sharing',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    },
    ...(plainJs ? { jsEngine: 'jsc' } : {}),
  },
};
