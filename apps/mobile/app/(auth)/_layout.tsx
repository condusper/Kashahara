import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
