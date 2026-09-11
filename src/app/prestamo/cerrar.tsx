import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { closeLoan, getLoansSummary, type LoanClosureType } from '@/features/prestamos/api';
import { formatMoneyText } from '@/utils/money';

export default function CloseLoanScreen() {
  const { prestamoId = '' } = useLocalSearchParams<{ prestamoId?: string }>();
  const queryClient = useQueryClient();
  const requestId = useRef(Crypto.randomUUID());
  const loansQuery = useQuery({ queryKey: ['prestamos'], queryFn: () => getLoansSummary() });
  const loan = loansQuery.data?.prestamos.find((item) => item.id === prestamoId);
  const [type, setType] = useState<LoanClosureType | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [completed, setCompleted] = useState<LoanClosureType | null>(null);
  const canAnnul = Boolean(loan && loan.tipo === 'NORMAL' && loan.total_pagado === '0.00');
  const validReason = reason.trim().length >= 3 && reason.trim().length <= 500;

  const mutation = useMutation({
    mutationFn: () => {
      if (!type) throw new Error('Selecciona cómo deseas cerrar el préstamo.');
      return closeLoan(prestamoId, type, reason, requestId.current);
    },
    onSuccess: async () => {
      const completedType = type;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prestamos'] }),
        queryClient.invalidateQueries({ queryKey: ['caja'] }),
        queryClient.invalidateQueries({ queryKey: ['actividad'] }),
        queryClient.invalidateQueries({ queryKey: ['clientes'] }),
        queryClient.invalidateQueries({ queryKey: ['cierre-prestamo', prestamoId] }),
      ]);
      setConfirming(false);
      setCompleted(completedType);
    },
  });

  function finish() {
    router.replace({ pathname: '/prestamo/[id]', params: { id: prestamoId } });
  }

  return <SafeAreaView edges={['top']} style={styles.safe}>
    <View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Cerrar préstamo</Text><View style={styles.topButton} /></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loansQuery.isPending ? <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.stateText}>Revisando el préstamo…</Text></View> : null}
        {loansQuery.isError || (loansQuery.isSuccess && (!loan || loan.estado !== 'ACTIVO')) ? <View style={styles.state}><View style={styles.stateIcon}><Ionicons color={colors.warning} name="alert-circle-outline" size={29} /></View><Text style={styles.stateTitle}>Este préstamo ya no puede cerrarse</Text><Text style={styles.stateText}>Vuelve al detalle para consultar su estado actualizado.</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backButtonText}>Volver</Text></Pressable></View> : null}
        {loan && loan.estado === 'ACTIVO' ? <>
          <View style={styles.hero}><View style={styles.heroIcon}><Ionicons color="#FFFFFF" name="shield-outline" size={25} /></View><View style={styles.heroCopy}><Text style={styles.heroEyebrow}>CIERRE CON TRAZABILIDAD</Text><Text style={styles.heroTitle}>¿Qué ocurrió con este préstamo?</Text><Text style={styles.heroText}>Elige el caso real. Ninguna opción elimina movimientos ni borra el historial.</Text></View></View>

          <View style={styles.loanSummary}><View><Text style={styles.summaryLabel}>{loan.cliente_nombre}</Text><Text style={styles.summaryMeta}>Saldo pendiente</Text></View><Text style={styles.summaryAmount}>{formatMoneyText(loan.saldo_pendiente, true)}</Text></View>

          <View style={styles.options}>
            <Text style={styles.sectionTitle}>Selecciona una opción</Text>
            <ChoiceCard active={type === 'INCOBRABLE'} color={colors.danger} description="El dinero sí fue entregado, pero ya no esperas recuperarlo. Caja no cambia." icon="alert-circle-outline" onPress={() => setType('INCOBRABLE')} softColor={colors.dangerSoft} title="Marcar como incobrable" />
            <ChoiceCard active={type === 'ANULACION'} color={colors.textSecondary} description="El préstamo se registró por error y el dinero realmente no salió. Revierte el desembolso en Caja." disabled={!canAnnul} icon="close-circle-outline" onPress={() => canAnnul && setType('ANULACION')} softColor={colors.surfaceSoft} title="Anular registro" />
            {!canAnnul ? <View style={styles.blockedNotice}><Ionicons color={colors.warning} name="lock-closed-outline" size={16} /><Text style={styles.blockedText}>{loan.tipo === 'RENOVACION' ? 'Una renovación está enlazada al préstamo anterior y no puede anularse de forma aislada.' : 'Anular no está disponible porque este préstamo ya tiene pagos aplicados.'}</Text></View> : null}
          </View>

          {type ? <View style={styles.formCard}><Text style={styles.sectionTitle}>Motivo del cierre</Text><Text style={styles.formHint}>Quedará visible en el historial para entender esta decisión en el futuro.</Text><TextInput maxLength={500} multiline onChangeText={setReason} placeholder={type === 'INCOBRABLE' ? 'Ej. Cliente informó que no podrá devolver el saldo' : 'Ej. Préstamo creado por duplicado'} placeholderTextColor={colors.textMuted} style={styles.input} textAlignVertical="top" value={reason} /><Text style={[styles.counter, !validReason && reason.length > 0 && styles.counterError]}>{reason.length}/500 · mínimo 3</Text><View style={[styles.impact, type === 'INCOBRABLE' ? styles.impactDanger : styles.impactNeutral]}><Ionicons color={type === 'INCOBRABLE' ? colors.danger : colors.textSecondary} name={type === 'INCOBRABLE' ? 'business-outline' : 'return-up-back-outline'} size={19} /><View style={styles.impactCopy}><Text style={styles.impactTitle}>{type === 'INCOBRABLE' ? 'Caja permanece igual' : `${formatMoneyText(loan.monto_desembolsado, true)} regresan a Caja`}</Text><Text style={styles.impactText}>{type === 'INCOBRABLE' ? `${formatMoneyText(loan.saldo_pendiente, true)} salen de “Por cobrar”, pero se conservan como saldo incobrable.` : 'El desembolso original quedará enlazado a su reverso. Usa esta opción solo si el dinero no se entregó.'}</Text></View></View></View> : null}

          {mutation.isError ? <View style={styles.errorBox}><Ionicons color={colors.danger} name="alert-circle-outline" size={18} /><Text style={styles.errorText}>{mutation.error.message}</Text></View> : null}
          <Pressable disabled={!type || !validReason || mutation.isPending} onPress={() => setConfirming(true)} style={({ pressed }) => [styles.submit, type === 'INCOBRABLE' && styles.submitDanger, (!type || !validReason || mutation.isPending || pressed) && styles.disabled]}><Ionicons color="#FFFFFF" name="shield-checkmark-outline" size={20} /><Text style={styles.submitText}>Revisar y confirmar</Text></Pressable>
          <Text style={styles.footerNote}>Esta acción no elimina el préstamo. Su trazabilidad seguirá disponible.</Text>
        </> : null}
      </ScrollView>
    </KeyboardAvoidingView>

    <ConfirmModal loading={mutation.isPending} loanAmount={loan?.saldo_pendiente ?? '0.00'} onCancel={() => setConfirming(false)} onConfirm={() => mutation.mutate()} type={type} visible={confirming} />
    <SuccessModal onContinue={finish} type={completed} visible={Boolean(completed)} />
  </SafeAreaView>;
}

function ChoiceCard({ active, disabled = false, color, softColor, icon, title, description, onPress }: { active: boolean; disabled?: boolean; color: string; softColor: string; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; description: string; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choice, active && { borderColor: color, backgroundColor: softColor }, disabled && styles.choiceDisabled, pressed && styles.pressed]}><View style={[styles.choiceIcon, { backgroundColor: softColor }]}><Ionicons color={color} name={icon} size={24} /></View><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{title}</Text><Text style={styles.choiceText}>{description}</Text></View><View style={[styles.radio, active && { borderColor: color }]}>{active ? <View style={[styles.radioDot, { backgroundColor: color }]} /> : null}</View></Pressable>;
}

function ConfirmModal({ visible, type, loanAmount, loading, onCancel, onConfirm }: { visible: boolean; type: LoanClosureType | null; loanAmount: string; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!type) return null;
  const incobrable = type === 'INCOBRABLE';
  return <Modal animationType="fade" onRequestClose={loading ? undefined : onCancel} statusBarTranslucent transparent visible={visible}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={[styles.modalIcon, { backgroundColor: incobrable ? colors.dangerSoft : colors.surfaceSoft }]}><Ionicons color={incobrable ? colors.danger : colors.textSecondary} name={incobrable ? 'alert-circle-outline' : 'close-circle-outline'} size={32} /></View><Text style={styles.modalTitle}>{incobrable ? '¿Marcar como incobrable?' : '¿Anular este registro?'}</Text><Text style={styles.modalText}>{incobrable ? `${formatMoneyText(loanAmount, true)} dejarán de contar como dinero por cobrar. No ingresará dinero a Caja.` : 'Confirma que el dinero nunca fue entregado. Caja recibirá el reverso del desembolso original.'}</Text><View style={styles.modalAudit}><Ionicons color={colors.primary} name="finger-print-outline" size={18} /><Text style={styles.modalAuditText}>El motivo y la fecha quedarán guardados de forma permanente.</Text></View><Pressable disabled={loading} onPress={onConfirm} style={[styles.modalConfirm, incobrable && styles.submitDanger, loading && styles.disabled]}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalConfirmText}>{incobrable ? 'Sí, marcar incobrable' : 'Sí, anular registro'}</Text>}</Pressable><Pressable disabled={loading} onPress={onCancel} style={styles.modalCancel}><Text style={styles.modalCancelText}>Volver y revisar</Text></Pressable></View></View></Modal>;
}

function SuccessModal({ visible, type, onContinue }: { visible: boolean; type: LoanClosureType | null; onContinue: () => void }) {
  const incobrable = type === 'INCOBRABLE';
  return <Modal animationType="fade" onRequestClose={onContinue} statusBarTranslucent transparent visible={visible}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.successIcon}><Ionicons color="#FFFFFF" name="checkmark" size={34} /></View><Text style={styles.modalTitle}>Cierre registrado</Text><Text style={styles.modalText}>{incobrable ? 'El préstamo salió de la cartera activa sin modificar Caja.' : 'El préstamo fue anulado y su desembolso quedó revertido en Caja.'}</Text><View style={styles.successAudit}><Ionicons color={colors.success} name="shield-checkmark-outline" size={18} /><Text style={styles.successAuditText}>El historial completo se conserva.</Text></View><Pressable onPress={onContinue} style={styles.successButton}><Text style={styles.modalConfirmText}>Ver préstamo</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /></Pressable></View></View></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, content: { width: '100%', maxWidth: Math.min(maxContentWidth, 620), alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  hero: { backgroundColor: colors.navy, borderRadius: radii.xl, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.card }, heroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#FFFFFF16', alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1 }, heroEyebrow: { color: '#AEBCE2', fontSize: 11, fontFamily: fonts.extraBold, letterSpacing: 1 }, heroTitle: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.extraBold, marginTop: 5 }, heroText: { color: '#C1C9DD', fontSize: 12, lineHeight: 19, fontFamily: fonts.regular, marginTop: 5 },
  loanSummary: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadows.card }, summaryLabel: { color: colors.text, fontSize: 16, fontFamily: fonts.bold }, summaryMeta: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium, marginTop: 4 }, summaryAmount: { color: colors.primary, fontSize: 18, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] },
  options: { gap: spacing.md }, sectionTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, choice: { minHeight: 104, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.card }, choiceDisabled: { opacity: 0.5 }, choiceIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, choiceCopy: { flex: 1 }, choiceTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.extraBold }, choiceText: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, fontFamily: fonts.regular, marginTop: 4 }, radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, radioDot: { width: 10, height: 10, borderRadius: 5 }, pressed: { opacity: 0.72 }, blockedNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningSoft, padding: spacing.md, borderRadius: radii.md }, blockedText: { flex: 1, color: colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: fonts.medium },
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm, ...shadows.card }, formHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: fonts.regular }, input: { minHeight: 106, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: radii.md, padding: spacing.md, color: colors.text, fontSize: 14, fontFamily: fonts.regular, marginTop: spacing.sm }, counter: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium, textAlign: 'right' }, counterError: { color: colors.danger }, impact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm }, impactDanger: { backgroundColor: colors.dangerSoft }, impactNeutral: { backgroundColor: colors.surfaceSoft }, impactCopy: { flex: 1 }, impactTitle: { color: colors.text, fontSize: 13, fontFamily: fonts.bold }, impactText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, marginTop: 3 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radii.md }, errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 18, fontFamily: fonts.medium }, submit: { minHeight: 55, borderRadius: radii.md, backgroundColor: colors.textSecondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, submitDanger: { backgroundColor: colors.danger }, submitText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bold }, disabled: { opacity: 0.45 }, footerNote: { color: colors.textMuted, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, textAlign: 'center' },
  state: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: spacing.md }, stateIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }, stateTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold, textAlign: 'center' }, stateText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: fonts.regular, textAlign: 'center' }, backButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md }, backButtonText: { color: colors.primary, fontSize: 13, fontFamily: fonts.bold },
  modalBackdrop: { flex: 1, backgroundColor: '#0B1024A8', padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }, modalCard: { width: '100%', maxWidth: 430, borderRadius: radii.xl, backgroundColor: colors.surface, padding: spacing.xxl, alignItems: 'center', ...shadows.card }, modalIcon: { width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }, modalTitle: { color: colors.text, fontSize: 19, fontFamily: fonts.extraBold, textAlign: 'center' }, modalText: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, fontFamily: fonts.regular, textAlign: 'center', marginTop: spacing.sm }, modalAudit: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.xl }, modalAuditText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontFamily: fonts.medium }, modalConfirm: { width: '100%', minHeight: 52, borderRadius: radii.md, backgroundColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl }, modalConfirmText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bold }, modalCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }, modalCancelText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.bold }, successIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }, successAudit: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successSoft, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.xl }, successAuditText: { flex: 1, color: colors.success, fontSize: 12, fontFamily: fonts.bold }, successButton: { width: '100%', minHeight: 52, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
});
