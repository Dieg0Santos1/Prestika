import { Ionicons } from '@expo/vector-icons';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '@/constants/design';
import { AppUpdateNotice } from '../components/app-update-notice';
import { queryClient } from '@/lib/query-client';
import { AppLockProvider, useAppLock } from '@/providers/app-lock-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...Ionicons.font,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLockProvider><RootNavigator /></AppLockProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { loading: authLoading, session } = useAuth();
  const { loading: lockLoading, unlocked } = useAppLock();
  if (authLoading || lockLoading) return null;
  const granted = Boolean(session && unlocked);

  return <><StatusBar style="dark" /><Stack initialRouteName={granted ? '(tabs)' : 'login'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
    <Stack.Screen name="descargar" options={{ animation: 'fade' }} />
    <Stack.Protected guard={!granted}><Stack.Screen name="login" options={{ animation: 'fade' }} /></Stack.Protected>
    <Stack.Protected guard={granted}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="cliente/nuevo" options={{ presentation: 'modal' }} />
      <Stack.Screen name="cliente/editar" options={{ presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="cliente/[id]" />
      <Stack.Screen name="cliente/historial" />
      <Stack.Screen name="caja/movimiento" options={{ presentation: 'modal' }} />
      <Stack.Screen name="caja/revertir" options={{ presentation: 'modal' }} />
      <Stack.Screen name="prestamo/nuevo" options={{ presentation: 'modal' }} />
      <Stack.Screen name="prestamo/[id]" />
      <Stack.Screen name="prestamo/renovar" options={{ presentation: 'modal' }} />
      <Stack.Screen name="prestamo/cerrar" options={{ presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="pago/nuevo" options={{ presentation: 'modal' }} />
      <Stack.Screen name="pago/revertir" options={{ presentation: 'modal' }} />
    </Stack.Protected>
  </Stack><AppUpdateNotice enabled={granted} /></>;
}
