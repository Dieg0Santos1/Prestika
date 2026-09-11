import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/providers/auth-provider';

type PinResult = { success: true } | { success: false; attemptsRemaining: number; blockedSeconds: number };
type PinRecord = { salt: string; hash: string };
type FailureRecord = { attempts: number; blockedUntil: number };

type AppLockContextValue = {
  loading: boolean;
  configured: boolean;
  unlocked: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  setupPin: (pin: string, enableBiometrics: boolean) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<PinResult>;
  unlockWithBiometrics: () => Promise<boolean>;
  resetLocalLock: () => Promise<void>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 30_000;

function storageKey(userId: string, suffix: 'pin' | 'biometric' | 'failures') {
  return `finanza.lock.${userId}.${suffix}`;
}

async function pinHash(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}:finanza-local-lock`);
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

function secureCompare(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function AppLockProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('biometría');
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const promptingRef = useRef(false);
  const automaticAttemptRef = useRef(false);

  const inspectBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') return { available: false, label: 'biometría' };
    try {
      const [hardware, enrolled, level, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.getEnrolledLevelAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      const strong = level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
      const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      return { available: hardware && enrolled && strong, label: face ? 'reconocimiento facial' : 'huella digital' };
    } catch {
      return { available: false, label: 'biometría' };
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (authLoading) return;
      if (!user) {
        if (active) { setConfigured(false); setUnlocked(false); setBiometricEnabled(false); setLoading(false); }
        return;
      }
      if (Platform.OS === 'web') {
        if (active) { setConfigured(true); setUnlocked(true); setBiometricAvailable(false); setLoading(false); }
        return;
      }
      setLoading(true);
      const [storedPin, storedBiometric, biometric] = await Promise.all([
        SecureStore.getItemAsync(storageKey(user.id, 'pin')),
        SecureStore.getItemAsync(storageKey(user.id, 'biometric')),
        inspectBiometrics(),
      ]);
      if (!active) return;
      const hasPin = Boolean(safeParse<PinRecord>(storedPin));
      setConfigured(hasPin);
      setUnlocked(false);
      setBiometricAvailable(biometric.available);
      setBiometricLabel(biometric.label);
      setBiometricEnabled(hasPin && storedBiometric === 'true' && biometric.available);
      automaticAttemptRef.current = false;
      setLoading(false);
    }
    initialize();
    return () => { active = false; };
  }, [authLoading, inspectBiometrics, user]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricAvailable || promptingRef.current) return false;
    promptingRef.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear Prestika',
        promptSubtitle: 'Confirma que eres tú',
        cancelLabel: 'Usar PIN',
        fallbackLabel: 'Usar PIN de Prestika',
        disableDeviceFallback: true,
        biometricsSecurityLevel: 'strong',
      });
      if (result.success) setUnlocked(true);
      return result.success;
    } catch {
      return false;
    } finally {
      promptingRef.current = false;
    }
  }, [biometricAvailable]);

  useEffect(() => {
    if (loading || !appIsActive || !configured || !biometricEnabled || !biometricAvailable || unlocked || automaticAttemptRef.current) return;
    automaticAttemptRef.current = true;
    unlockWithBiometrics();
  }, [appIsActive, biometricAvailable, biometricEnabled, configured, loading, unlockWithBiometrics, unlocked]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      setAppIsActive(state === 'active');
      if ((state === 'inactive' || state === 'background') && !promptingRef.current) {
        automaticAttemptRef.current = false;
        setUnlocked(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const setupPin = useCallback(async (pin: string, enableBiometrics: boolean) => {
    if (!user || !/^\d{6}$/.test(pin)) throw new Error('El PIN debe tener exactamente 6 dígitos.');
    const salt = Crypto.randomUUID();
    const hash = await pinHash(pin, salt);
    let biometricWasEnabled = false;
    if (enableBiometrics && biometricAvailable) {
      promptingRef.current = true;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Activar acceso biométrico',
          promptSubtitle: 'Confirma tu identidad para finalizar',
          cancelLabel: 'Ahora no',
          disableDeviceFallback: true,
          biometricsSecurityLevel: 'strong',
        });
        biometricWasEnabled = result.success;
      } catch {
        biometricWasEnabled = false;
      } finally {
        promptingRef.current = false;
      }
    }
    await Promise.all([
      SecureStore.setItemAsync(storageKey(user.id, 'pin'), JSON.stringify({ salt, hash } satisfies PinRecord)),
      SecureStore.setItemAsync(storageKey(user.id, 'biometric'), biometricWasEnabled ? 'true' : 'false'),
      SecureStore.deleteItemAsync(storageKey(user.id, 'failures')),
    ]);
    setConfigured(true);
    setBiometricEnabled(biometricWasEnabled);
    automaticAttemptRef.current = true;
    setUnlocked(true);
  }, [biometricAvailable, user]);

  const unlockWithPin = useCallback(async (pin: string): Promise<PinResult> => {
    if (!user || !/^\d{6}$/.test(pin)) return { success: false, attemptsRemaining: MAX_ATTEMPTS, blockedSeconds: 0 };
    const failureKey = storageKey(user.id, 'failures');
    const failure = safeParse<FailureRecord>(await SecureStore.getItemAsync(failureKey)) ?? { attempts: 0, blockedUntil: 0 };
    const now = Date.now();
    if (failure.blockedUntil > now) return { success: false, attemptsRemaining: 0, blockedSeconds: Math.ceil((failure.blockedUntil - now) / 1000) };
    const record = safeParse<PinRecord>(await SecureStore.getItemAsync(storageKey(user.id, 'pin')));
    if (!record) throw new Error('No encontramos el PIN de este dispositivo.');
    const candidate = await pinHash(pin, record.salt);
    if (secureCompare(candidate, record.hash)) {
      await SecureStore.deleteItemAsync(failureKey);
      automaticAttemptRef.current = true;
      setUnlocked(true);
      return { success: true };
    }
    const attempts = failure.attempts + 1;
    const blocked = attempts >= MAX_ATTEMPTS;
    await SecureStore.setItemAsync(failureKey, JSON.stringify({ attempts: blocked ? 0 : attempts, blockedUntil: blocked ? now + BLOCK_DURATION_MS : 0 } satisfies FailureRecord));
    return { success: false, attemptsRemaining: blocked ? 0 : MAX_ATTEMPTS - attempts, blockedSeconds: blocked ? BLOCK_DURATION_MS / 1000 : 0 };
  }, [user]);

  const resetLocalLock = useCallback(async () => {
    if (!user || Platform.OS === 'web') return;
    await Promise.all([
      SecureStore.deleteItemAsync(storageKey(user.id, 'pin')),
      SecureStore.deleteItemAsync(storageKey(user.id, 'biometric')),
      SecureStore.deleteItemAsync(storageKey(user.id, 'failures')),
    ]);
    automaticAttemptRef.current = false;
    setConfigured(false);
    setBiometricEnabled(false);
    setUnlocked(false);
  }, [user]);

  const value = useMemo<AppLockContextValue>(() => ({ loading, configured, unlocked, biometricAvailable, biometricEnabled, biometricLabel, setupPin, unlockWithPin, unlockWithBiometrics, resetLocalLock }), [biometricAvailable, biometricEnabled, biometricLabel, configured, loading, resetLocalLock, setupPin, unlockWithBiometrics, unlockWithPin, unlocked]);
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock debe usarse dentro de AppLockProvider.');
  return value;
}
