import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { AccountAccess } from '@/features/auth/account-access';
import { useAppLock } from '@/providers/app-lock-provider';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const { session } = useAuth();
  const lock = useAppLock();
  if (!session) return <AccountAccess />;
  if (!lock.configured) return <PinSetup />;
  return <PinUnlock />;
}

function PinSetup() {
  const { signOut } = useAuth();
  const { biometricAvailable, biometricLabel, setupPin } = useAppLock();
  const [step, setStep] = useState<'CREATE' | 'CONFIRM'>('CREATE');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [enableBiometrics, setEnableBiometrics] = useState(biometricAvailable);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function enterDigit(digit: string) {
    if (submitting || pin.length >= 6) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError(null);
    if (next.length !== 6) return;
    if (step === 'CREATE') {
      setTimeout(() => { setFirstPin(next); setPin(''); setStep('CONFIRM'); }, 160);
      return;
    }
    if (next !== firstPin) {
      setTimeout(() => { setPin(''); setError('Los PIN no coinciden. Inténtalo nuevamente.'); }, 160);
      return;
    }
    setSubmitting(true);
    setupPin(next, enableBiometrics).catch((reason) => {
      setPin('');
      setError(reason instanceof Error ? reason.message : 'No pudimos configurar el PIN.');
      setSubmitting(false);
    });
  }

  return <LockShell eyebrow="PROTECCIÓN DEL DISPOSITIVO" icon="shield-checkmark" title={step === 'CREATE' ? 'Crea tu PIN' : 'Confirma tu PIN'} subtitle={step === 'CREATE' ? 'Usarás estos 6 dígitos para acceder rápidamente a tu cartera.' : 'Vuelve a escribirlo para comprobar que lo recuerdas.'}>
    <PinDots length={pin.length} error={Boolean(error)} />
    {error ? <Text accessibilityRole="alert" style={styles.pinError}>{error}</Text> : <Text style={styles.pinHelper}>{step === 'CREATE' ? 'No uses números fáciles de adivinar.' : 'Tu PIN se guarda protegido únicamente en este celular.'}</Text>}
    {step === 'CREATE' && biometricAvailable ? <Pressable onPress={() => setEnableBiometrics((value) => !value)} style={[styles.biometricChoice, enableBiometrics && styles.biometricChoiceActive]}><View style={[styles.choiceIcon, enableBiometrics && styles.choiceIconActive]}><Ionicons color={enableBiometrics ? '#FFFFFF' : colors.primary} name="finger-print" size={21} /></View><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>Usar {biometricLabel}</Text><Text style={styles.choiceText}>Primero confirmarás este PIN y luego tu identidad.</Text></View><Ionicons color={enableBiometrics ? colors.primary : colors.textMuted} name={enableBiometrics ? 'checkmark-circle' : 'ellipse-outline'} size={21} /></Pressable> : null}
    {submitting ? <View style={styles.processing}><ActivityIndicator color={colors.primary} /><Text style={styles.processingText}>Protegiendo tu acceso…</Text></View> : <PinPad onDigit={enterDigit} onErase={() => setPin((value) => value.slice(0, -1))} />}
    {step === 'CONFIRM' ? <Pressable onPress={() => { setStep('CREATE'); setFirstPin(''); setPin(''); setError(null); }} style={styles.textAction}><Text style={styles.textActionLabel}>Empezar de nuevo</Text></Pressable> : null}
    <Pressable onPress={signOut} style={styles.accountAction}><Text style={styles.accountActionText}>Salir de esta cuenta</Text></Pressable>
  </LockShell>;
}

function PinUnlock() {
  const { signOut } = useAuth();
  const { biometricAvailable, biometricEnabled, biometricLabel, resetLocalLock, unlockWithBiometrics, unlockWithPin } = useAppLock();
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(next: string) {
    setChecking(true);
    try {
      const result = await unlockWithPin(next);
      if (!result.success) {
        setPin('');
        setError(result.blockedSeconds ? `Demasiados intentos. Espera ${result.blockedSeconds} segundos.` : `PIN incorrecto. Te quedan ${result.attemptsRemaining} intentos.`);
        setChecking(false);
      }
    } catch (reason) {
      setPin('');
      setError(reason instanceof Error ? reason.message : 'No pudimos comprobar el PIN.');
      setChecking(false);
    }
  }

  function enterDigit(digit: string) {
    if (checking || pin.length >= 6) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError(null);
    if (next.length === 6) void verify(next);
  }

  async function useBiometrics() {
    if (checking) return;
    setChecking(true);
    setError(null);
    const success = await unlockWithBiometrics();
    if (!success) { setError('No se pudo verificar tu identidad. Puedes ingresar con tu PIN.'); setChecking(false); }
  }

  async function recoverAccess() {
    try {
      await signOut();
      await resetLocalLock();
    } catch {
      setError('No pudimos preparar la recuperación. Inténtalo nuevamente.');
    }
  }

  return <LockShell eyebrow="ACCESO SEGURO" icon="lock-closed" title="Ingresa tu PIN" subtitle="Desbloquea tu cartera con tus 6 dígitos.">
    <PinDots length={pin.length} error={Boolean(error)} />
    {error ? <Text accessibilityRole="alert" style={styles.pinError}>{error}</Text> : <Text style={styles.pinHelper}>{checking ? 'Comprobando…' : 'Tu información financiera permanece protegida.'}</Text>}
    {biometricAvailable && biometricEnabled ? <Pressable disabled={checking} onPress={useBiometrics} style={({ pressed }) => [styles.biometricButton, pressed && styles.pressed]}><View style={styles.biometricButtonIcon}><Ionicons color={colors.primary} name="finger-print" size={23} /></View><Text style={styles.biometricButtonText}>Usar {biometricLabel}</Text></Pressable> : null}
    <PinPad disabled={checking} onDigit={enterDigit} onErase={() => setPin((value) => value.slice(0, -1))} />
    <Pressable onPress={() => Alert.alert('Recuperar acceso', 'Para proteger tus datos, tendrás que verificar nuevamente tu correo con un código.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Continuar', style: 'destructive', onPress: () => void recoverAccess() }])} style={styles.accountAction}><Text style={styles.accountActionText}>Olvidé mi PIN</Text></Pressable>
  </LockShell>;
}

function LockShell({ eyebrow, icon, title, subtitle, children }: { eyebrow: string; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; children: React.ReactNode }) {
  return <SafeAreaView style={styles.safeArea}><ScrollView alwaysBounceVertical={false} contentContainerStyle={styles.lockPage} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><View style={styles.lockBrand}><Image accessibilityLabel="Icono de Prestika" contentFit="cover" source={require('../../assets/images/Icono.png')} style={styles.brandIcon} /><View><Text style={styles.brand}>PRESTIKA</Text><Text style={styles.brandCaption}>CARTERA BAJO CONTROL</Text></View></View><View style={styles.lockCard}><View style={styles.lockIcon}><Ionicons color={colors.primary} name={icon} size={25} /></View><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.lockTitle}>{title}</Text><Text style={styles.lockSubtitle}>{subtitle}</Text>{children}</View><View style={styles.securityFoot}><Ionicons color={colors.success} name="shield-checkmark-outline" size={16} /><Text style={styles.securityFootText}>Sesión protegida en este dispositivo</Text></View></ScrollView></SafeAreaView>;
}

function PinDots({ length, error }: { length: number; error: boolean }) {
  return <View accessibilityLabel={`${length} de 6 dígitos ingresados`} style={styles.dots}>{Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.dot, index < length && styles.dotFilled, error && styles.dotError]} />)}</View>;
}

function PinPad({ onDigit, onErase, disabled = false }: { onDigit: (digit: string) => void; onErase: () => void; disabled?: boolean }) {
  const keys: (string | null)[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'erase'];
  return <View style={styles.keypad}>{keys.map((key, index) => key === null ? <View key={`empty-${index}`} style={styles.key} /> : <Pressable accessibilityLabel={key === 'erase' ? 'Borrar dígito' : key} disabled={disabled} key={key} onPress={() => key === 'erase' ? onErase() : onDigit(key)} style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>{key === 'erase' ? <Ionicons color={colors.textSecondary} name="backspace-outline" size={25} /> : <Text style={styles.keyText}>{key}</Text>}</Pressable>)}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F6FB' }, lockPage: { flexGrow: 1, width: '100%', maxWidth: 470, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, lockBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }, brandIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.navy, ...shadows.card }, brand: { color: colors.navy, fontSize: 16, fontFamily: fonts.extraBold, letterSpacing: 2 }, brandCaption: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold, letterSpacing: 1.2, marginTop: 3 }, lockCard: { width: '100%', backgroundColor: colors.surface, borderRadius: 30, paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: '#EBEDF5', ...shadows.card }, lockIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: colors.primary, fontSize: 10, fontFamily: fonts.extraBold, letterSpacing: 1.2, marginTop: spacing.md }, lockTitle: { color: colors.text, fontSize: 24, fontFamily: fonts.extraBold, letterSpacing: -0.5, marginTop: 3 }, lockSubtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: fonts.regular, textAlign: 'center', maxWidth: 310, marginTop: 5 }, dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: spacing.xl }, dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: '#CFD3E1', backgroundColor: colors.background }, dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary, transform: [{ scale: 1.08 }] }, dotError: { borderColor: colors.danger }, pinHelper: { minHeight: 32, color: colors.textMuted, fontSize: 11, lineHeight: 17, fontFamily: fonts.medium, textAlign: 'center', marginTop: spacing.md }, pinError: { minHeight: 32, color: colors.danger, fontSize: 11, lineHeight: 17, fontFamily: fonts.semibold, textAlign: 'center', marginTop: spacing.md }, keypad: { width: 270, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.sm }, key: { width: 90, height: 58, alignItems: 'center', justifyContent: 'center' }, keyPressed: { opacity: 0.48, transform: [{ scale: 0.92 }] }, keyText: { color: colors.text, fontSize: 23, fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] }, biometricButton: { minHeight: 48, alignSelf: 'stretch', borderRadius: radii.md, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, biometricButtonIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, biometricButtonText: { color: colors.primary, fontSize: 13, fontFamily: fonts.extraBold }, biometricChoice: { alignSelf: 'stretch', minHeight: 68, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }, biometricChoiceActive: { borderColor: '#D8D2FF', backgroundColor: colors.primarySoft }, choiceIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, choiceIconActive: { backgroundColor: colors.primary }, choiceCopy: { flex: 1 }, choiceTitle: { color: colors.text, fontSize: 13, fontFamily: fonts.extraBold }, choiceText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, fontFamily: fonts.regular, marginTop: 3 }, processing: { height: 184, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, processingText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium }, textAction: { minHeight: 32, justifyContent: 'center' }, textActionLabel: { color: colors.primary, fontSize: 12, fontFamily: fonts.bold }, accountAction: { minHeight: 34, justifyContent: 'center', marginTop: 2 }, accountActionText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.semibold }, securityFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xl }, securityFootText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium }, pressed: { opacity: 0.7 },
});
