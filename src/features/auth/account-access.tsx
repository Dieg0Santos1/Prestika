import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { isSupabaseConfigured } from '@/lib/supabase';
import { type RegistrationProfile, useAuth } from '@/providers/auth-provider';

type AccessMode = 'REGISTER' | 'ACCESS';
type AccessStep = 'FORM' | 'CODE';

export function AccountAccess() {
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const [mode, setMode] = useState<AccessMode>('REGISTER');
  const [step, setStep] = useState<AccessStep>('FORM');
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (step !== 'CODE') return;
    const interval = setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1_000);
    return () => clearInterval(interval);
  }, [step]);

  const normalizedEmail = email.trim().toLowerCase();
  const profile: RegistrationProfile | undefined = mode === 'REGISTER'
    ? { nombre: nombre.trim(), celular: celular.trim() }
    : undefined;

  async function sendCode() {
    if (submitLock.current) return;
    const validation = validateForm(mode, nombre, celular, normalizedEmail);
    if (validation) {
      setError(validation);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await sendEmailCode(normalizedEmail, mode === 'REGISTER', profile);
      setCode('');
      setCooldown(60);
      setStep('CODE');
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    if (submitLock.current || code.length !== 6) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await verifyEmailCode(normalizedEmail, code, profile);
    } catch (reason) {
      setCode('');
      setError(authErrorMessage(reason));
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function changeMode() {
    setMode((value) => value === 'REGISTER' ? 'ACCESS' : 'REGISTER');
    setStep('FORM');
    setCode('');
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>P</Text>
            </View>
            <View>
              <Text style={styles.brand}>PRESTIKA</Text>
              <Text style={styles.brandCaption}>CARTERA BAJO CONTROL</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.progressRow}>
              <View style={[styles.progressLine, styles.progressLineActive]} />
              <View style={[styles.progressLine, step === 'CODE' && styles.progressLineActive]} />
              <View style={styles.progressLine} />
            </View>

            <View style={styles.iconBox}>
              <Ionicons color={colors.primary} name={step === 'FORM' ? 'person-add-outline' : 'mail-open-outline'} size={24} />
            </View>
            <Text style={styles.eyebrow}>{step === 'FORM' ? 'PRIMER ACCESO' : 'VERIFICA TU CORREO'}</Text>
            <Text style={styles.title}>
              {step === 'FORM'
                ? mode === 'REGISTER' ? 'Crea tu espacio' : 'Vincula este celular'
                : 'Ingresa el código'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'FORM'
                ? mode === 'REGISTER'
                  ? 'Registra tus datos una sola vez. Después entrarás con PIN o biometría.'
                  : 'Te enviaremos un código para recuperar tus datos en este dispositivo.'
                : `Enviamos un código de 6 dígitos a ${normalizedEmail}.`}
            </Text>

            {step === 'FORM' ? (
              <View style={styles.form}>
                {mode === 'REGISTER' ? <>
                  <Field
                    autoCapitalize="words"
                    autoComplete="name"
                    icon="person-outline"
                    onChangeText={(value) => { setNombre(value); setError(null); }}
                    placeholder="Nombre completo"
                    value={nombre}
                  />
                  <Field
                    autoComplete="tel"
                    icon="call-outline"
                    keyboardType="phone-pad"
                    onChangeText={(value) => { setCelular(value); setError(null); }}
                    placeholder="Número de celular"
                    value={celular}
                  />
                </> : null}
                <Field
                  autoCapitalize="none"
                  autoComplete="email"
                  icon="mail-outline"
                  keyboardType="email-address"
                  onChangeText={(value) => { setEmail(value); setError(null); }}
                  onSubmitEditing={() => void sendCode()}
                  placeholder="Correo electrónico"
                  value={email}
                />
              </View>
            ) : (
              <View style={styles.codeArea}>
                <TextInput
                  accessibilityLabel="Código de verificación de 6 dígitos"
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                  onSubmitEditing={() => void verifyCode()}
                  placeholder="000000"
                  placeholderTextColor="#C9C5E8"
                  selectionColor={colors.primary}
                  style={styles.codeInput}
                  textContentType="oneTimeCode"
                  value={code}
                />
                <View style={styles.codeHint}>
                  <Ionicons color={colors.success} name="shield-checkmark-outline" size={16} />
                  <Text style={styles.codeHintText}>El código es temporal y solo funciona una vez.</Text>
                </View>
              </View>
            )}

            {!isSupabaseConfigured ? <ErrorBanner message="Falta configurar la conexión segura de la aplicación." /> : null}
            {error ? <ErrorBanner message={error} /> : null}

            <Pressable
              disabled={submitting || !isSupabaseConfigured || (step === 'CODE' && code.length !== 6)}
              onPress={() => void (step === 'FORM' ? sendCode() : verifyCode())}
              style={({ pressed }) => [
                styles.primaryButton,
                (submitting || !isSupabaseConfigured || (step === 'CODE' && code.length !== 6)) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}>
              {submitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <><Text style={styles.primaryLabel}>{step === 'FORM' ? 'Enviar código seguro' : 'Verificar y continuar'}</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /></>}
            </Pressable>

            {step === 'CODE' ? (
              <View style={styles.codeActions}>
                <Pressable disabled={submitting || cooldown > 0} onPress={() => void sendCode()} style={styles.secondaryAction}>
                  <Text style={[styles.secondaryLabel, cooldown > 0 && styles.secondaryLabelDisabled]}>
                    {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
                  </Text>
                </Pressable>
                <View style={styles.actionDivider} />
                <Pressable disabled={submitting} onPress={() => { setStep('FORM'); setCode(''); setError(null); }} style={styles.secondaryAction}>
                  <Text style={styles.secondaryLabel}>Cambiar correo</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable disabled={submitting} onPress={changeMode} style={styles.switchButton}>
                <Text style={styles.switchPrompt}>{mode === 'REGISTER' ? '¿Ya tienes una cuenta?' : '¿Es tu primera vez?'}</Text>
                <Text style={styles.switchLabel}>{mode === 'REGISTER' ? ' Acceder' : ' Crear cuenta'}</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.securityFooter}>
            <Ionicons color={colors.success} name="lock-closed-outline" size={15} />
            <Text style={styles.securityFooterText}>Tus credenciales nunca se guardan dentro de la app</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

function Field({ icon, style: _style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldIcon}>
        <Ionicons color={colors.primary} name={icon} size={19} />
      </View>
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <Ionicons color={colors.danger} name="alert-circle-outline" size={19} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function validateForm(mode: AccessMode, nombre: string, celular: string, email: string) {
  if (mode === 'REGISTER' && nombre.trim().length < 2) return 'Ingresa tu nombre completo.';
  const phoneDigits = celular.replace(/\D/g, '');
  if (mode === 'REGISTER' && (phoneDigits.length < 6 || phoneDigits.length > 15)) return 'Ingresa un número de celular válido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Ingresa un correo electrónico válido.';
  return null;
}

function authErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
  const rawMessage = error instanceof Error ? error.message : '';
  const message = rawMessage.toLowerCase();
  if (status === 429 || code.includes('rate_limit') || message.includes('rate limit')) return 'Solicitaste varios códigos seguidos. Espera un momento antes de intentarlo nuevamente.';
  if (code.includes('otp_expired') || message.includes('expired')) return 'El código venció. Solicita uno nuevo para continuar.';
  if (code.includes('invalid') || message.includes('token') || message.includes('otp')) return 'El código no es correcto. Revísalo o solicita uno nuevo.';
  if (message.includes('user not found') || message.includes('signups not allowed')) return 'No encontramos una cuenta con ese correo. Puedes crear una desde esta pantalla.';
  if (rawMessage) return rawMessage;
  return 'No pudimos completar el acceso. Revisa tu conexión e inténtalo nuevamente.';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F6FB' },
  keyboardView: { flex: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', justifyContent: 'center', padding: spacing.xl },
  brandRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  brandMark: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, ...shadows.card },
  brandLetter: { color: '#FFFFFF', fontSize: 24, fontFamily: fonts.extraBold },
  brand: { color: colors.navy, fontSize: 17, fontFamily: fonts.extraBold, letterSpacing: 2 },
  brandCaption: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold, letterSpacing: 1.2, marginTop: 3 },
  card: { width: '100%', borderWidth: 1, borderColor: '#EBEDF5', borderRadius: 30, backgroundColor: colors.surface, padding: spacing.xxl, alignItems: 'center', ...shadows.card },
  progressRow: { width: '100%', flexDirection: 'row', gap: 6, marginBottom: spacing.xl },
  progressLine: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E9EAF2' },
  progressLineActive: { backgroundColor: colors.primary },
  iconBox: { width: 50, height: 50, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.primary, fontSize: 11, fontFamily: fonts.extraBold, letterSpacing: 1.3, marginTop: spacing.md },
  title: { color: colors.text, fontSize: 25, fontFamily: fonts.extraBold, letterSpacing: -0.6, marginTop: 4, textAlign: 'center' },
  subtitle: { maxWidth: 340, color: colors.textSecondary, fontSize: 14, lineHeight: 22, fontFamily: fonts.regular, textAlign: 'center', marginTop: 6 },
  form: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.xl },
  field: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: '#FAFAFD' },
  fieldIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  input: { flex: 1, color: colors.text, fontSize: 16, fontFamily: fonts.medium, paddingVertical: spacing.md },
  codeArea: { alignSelf: 'stretch', marginTop: spacing.xl },
  codeInput: { height: 74, borderWidth: 1, borderColor: '#D9D4FF', borderRadius: radii.lg, backgroundColor: colors.primarySoft, color: colors.primaryDark, fontSize: 30, fontFamily: fonts.extraBold, letterSpacing: 10, textAlign: 'center', paddingLeft: 10, fontVariant: ['tabular-nums'] },
  codeHint: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.md },
  codeHintText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium },
  errorBanner: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderColor: '#F7D5DA', borderRadius: radii.md, backgroundColor: colors.dangerSoft, padding: spacing.md, marginTop: spacing.md },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 20, fontFamily: fonts.semibold },
  primaryButton: { alignSelf: 'stretch', minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary, marginTop: spacing.lg },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryLabel: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.extraBold },
  codeActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  secondaryAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  secondaryLabel: { color: colors.primary, fontSize: 12, fontFamily: fonts.bold },
  secondaryLabelDisabled: { color: colors.textMuted },
  actionDivider: { width: 1, height: 18, backgroundColor: colors.border },
  switchButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  switchPrompt: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium },
  switchLabel: { color: colors.primary, fontSize: 13, fontFamily: fonts.extraBold },
  securityFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xl },
  securityFooterText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
