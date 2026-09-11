import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { getActiveNativeRelease, type NativeAppRelease } from '@/features/updates/api';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

type Notice =
  | { kind: 'native'; release: NativeAppRelease; required: boolean }
  | { kind: 'ota' };

function currentBuildNumber() {
  const parsed = Number.parseInt(Constants.nativeBuildVersion ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AppUpdateNotice({ enabled }: { enabled: boolean }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);
  const dismissedNativeRef = useRef<string | null>(null);
  const dismissedOtaRef = useRef(false);

  const checkUpdates = useCallback(async (force = false) => {
    if (!enabled || checkingRef.current || __DEV__) return;
    const now = Date.now();
    if (!force && now - lastCheckRef.current < CHECK_INTERVAL_MS) return;

    checkingRef.current = true;
    lastCheckRef.current = now;
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        try {
          const release = await getActiveNativeRelease(Platform.OS);
          const build = currentBuildNumber();
          if (
            release &&
            build !== null &&
            build < release.numero_compilacion &&
            dismissedNativeRef.current !== release.id
          ) {
            setNotice({
              kind: 'native',
              release,
              required: release.obligatoria || build < release.compilacion_minima,
            });
            return;
          }
        } catch {
          // Un fallo temporal de Supabase nunca debe impedir usar la cartera.
        }
      }

      if (Updates.isEnabled && !dismissedOtaRef.current) {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          const fetched = await Updates.fetchUpdateAsync();
          if (fetched.isNew) setNotice({ kind: 'ota' });
        }
      }
    } catch {
      // Las comprobaciones son silenciosas y se reintentan al volver a la app.
    } finally {
      checkingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const initialCheck = setTimeout(() => void checkUpdates(true), 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkUpdates();
    });
    return () => {
      clearTimeout(initialCheck);
      subscription.remove();
    };
  }, [checkUpdates, enabled]);

  function dismiss() {
    if (!notice || (notice.kind === 'native' && notice.required)) return;
    if (notice.kind === 'native') dismissedNativeRef.current = notice.release.id;
    else dismissedOtaRef.current = true;
    setActionError(null);
    setNotice(null);
  }

  async function applyUpdate() {
    if (!notice || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      if (notice.kind === 'ota') {
        await Updates.reloadAsync();
        return;
      }
      await Linking.openURL(notice.release.url_descarga);
    } catch {
      setActionError(
        notice.kind === 'ota'
          ? 'No pudimos reiniciar Prestika. Ciérrala y vuelve a abrirla.'
          : 'No pudimos abrir la descarga. Revisa tu conexión e inténtalo otra vez.',
      );
    } finally {
      setBusy(false);
    }
  }

  const isNative = notice?.kind === 'native';
  const required = isNative ? notice.required : false;
  const title = isNative ? notice.release.titulo : 'Prestika está lista para actualizarse';
  const message = isNative
    ? notice.release.mensaje
    : 'La mejora ya se descargó. Reinicia la aplicación para disfrutar de la nueva versión.';
  const notes = isNative ? notice.release.novedades.slice(0, 3) : [];

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
      transparent
      visible={enabled && Boolean(notice)}>
      <Pressable disabled={required} onPress={dismiss} style={styles.backdrop}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={[styles.iconShell, isNative ? styles.iconNative : styles.iconOta]}>
              <Ionicons
                color={isNative ? colors.primary : colors.success}
                name={isNative ? 'rocket-outline' : 'sparkles'}
                size={28}
              />
            </View>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>{isNative ? 'NUEVA VERSIÓN' : 'ACTUALIZACIÓN LISTA'}</Text>
                <Text style={styles.title}>{title}</Text>
              </View>
              {!required ? (
                <Pressable accessibilityLabel="Cerrar aviso" hitSlop={10} onPress={dismiss} style={styles.closeButton}>
                  <Ionicons color={colors.textSecondary} name="close" size={20} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.message}>{message}</Text>

            {notes.length ? (
              <View style={styles.notes}>
                {notes.map((item) => (
                  <View key={item} style={styles.noteRow}>
                    <View style={styles.noteDot} />
                    <Text style={styles.noteText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {required ? (
              <View style={styles.requiredPill}>
                <Ionicons color={colors.warning} name="shield-checkmark-outline" size={16} />
                <Text style={styles.requiredText}>Esta actualización es necesaria para continuar con seguridad.</Text>
              </View>
            ) : null}
            {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

            <Pressable
              disabled={busy}
              onPress={applyUpdate}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>
              <Ionicons color="#FFFFFF" name={isNative ? 'download-outline' : 'refresh'} size={20} />
              <Text style={styles.primaryButtonText}>
                {busy ? 'Un momento...' : isNative ? 'Descargar actualización' : 'Actualizar ahora'}
              </Text>
            </Pressable>
            {!required ? (
              <Pressable onPress={dismiss} style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}>
                <Text style={styles.laterButtonText}>{isNative ? 'Ahora no' : 'Después'}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 20, 52, 0.48)',
    justifyContent: 'flex-end',
  },
  safeArea: { width: '100%' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    ...shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: radii.round,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  iconShell: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconNative: { backgroundColor: colors.primarySoft },
  iconOta: { backgroundColor: colors.successSoft },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headingCopy: { flex: 1 },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.extraBold,
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.45,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  notes: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 10,
    marginTop: spacing.lg,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8 },
  noteText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 },
  requiredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  requiredText: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  errorText: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  primaryButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  primaryButtonText: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 15 },
  laterButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  laterButtonText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.65 },
});
