import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { registerPayment, getLoansSummary } from '@/features/prestamos/api';
import { compareMoneyText, paymentFormSchema, subtractMoneyText, type PaymentFormValues } from '@/features/pagos/schema';
import { formatMoneyText } from '@/utils/money';

const methods = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'] as const;
type PaymentMode = 'CUOTA' | 'TOTAL';

export default function NewPaymentScreen() {
  const { prestamoId = '' } = useLocalSearchParams<{ prestamoId?: string }>();
  const queryClient = useQueryClient();
  const requestId = useRef(Crypto.randomUUID());
  const [mode, setMode] = useState<PaymentMode>('CUOTA');
  const [carryPrompt, setCarryPrompt] = useState<{ values: PaymentFormValues; remaining: string } | null>(null);
  const [confirmed, setConfirmed] = useState<{ amount: string; method: string } | null>(null);
  const loansQuery = useQuery({ queryKey: ['prestamos'], queryFn: () => getLoansSummary() });
  const loan = loansQuery.data?.prestamos.find((item) => item.id === prestamoId);
  const currentInstallment = loan?.cuotas.find((installment) => installment.estado !== 'PAGADA');
  const hasNextInstallment = Boolean(loan && currentInstallment && currentInstallment.numero < loan.numero_cuotas);
  const { control, handleSubmit, setError, setValue, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { monto: '', medio: 'EFECTIVO', nota: '' },
  });

  useEffect(() => {
    if (!loan) return;
    setValue('medio', methods.includes(loan.medio_desembolso as typeof methods[number]) ? loan.medio_desembolso as typeof methods[number] : 'EFECTIVO');
  }, [loan, setValue]);

  useEffect(() => {
    const amount = mode === 'TOTAL' ? loan?.saldo_pendiente : currentInstallment?.saldo_pendiente;
    if (amount) setValue('monto', amount, { shouldValidate: false });
  }, [currentInstallment?.saldo_pendiente, loan?.saldo_pendiente, mode, setValue]);

  const mutation = useMutation({
    mutationFn: ({ values, carry }: { values: PaymentFormValues; carry: boolean }) => registerPayment({
      prestamoId,
      monto: values.monto,
      medio: values.medio,
      nota: values.nota,
      trasladarRestante: carry,
      pagoTotal: mode === 'TOTAL',
      requestId: requestId.current,
    }),
    onSuccess: async (_, variables) => {
      setCarryPrompt(null);
      setConfirmed({ amount: variables.values.monto, method: variables.values.medio });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prestamos'] }),
        queryClient.invalidateQueries({ queryKey: ['caja'] }),
        queryClient.invalidateQueries({ queryKey: ['actividad'] }),
      ]);
    },
    onError: (error) => {
      setCarryPrompt(null);
      setError('monto', { message: error.message });
    },
  });

  function submit(values: PaymentFormValues) {
    if (!loan || !currentInstallment) return;
    const limit = mode === 'TOTAL' ? loan.saldo_pendiente : currentInstallment.saldo_pendiente;
    if (compareMoneyText(values.monto, limit) > 0n) {
      setError('monto', { message: `El máximo para esta opción es ${formatMoneyText(limit, true)}.` });
      return;
    }
    if (mode === 'TOTAL' && compareMoneyText(values.monto, loan.saldo_pendiente) !== 0n) {
      setError('monto', { message: 'La cancelación debe cubrir exactamente todo el saldo.' });
      return;
    }
    if (mode === 'CUOTA' && compareMoneyText(values.monto, currentInstallment.saldo_pendiente) < 0n && hasNextInstallment) {
      setCarryPrompt({ values, remaining: subtractMoneyText(currentInstallment.saldo_pendiente, values.monto) });
      return;
    }
    mutation.mutate({ values, carry: false });
  }

  function goToDetail() {
    router.replace({ pathname: '/prestamo/[id]', params: { id: prestamoId } });
  }

  if (confirmed) return <SafeAreaView style={styles.safe}><PaymentSuccessModal amount={confirmed.amount} method={confirmed.method} onContinue={goToDetail} visible /></SafeAreaView>;
  if (loansQuery.isPending) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.loadingText}>Preparando el pago…</Text></SafeAreaView>;
  if (!loan || !currentInstallment || loan.estado !== 'ACTIVO') return <SafeAreaView style={styles.center}><Ionicons color={colors.warning} name="alert-circle-outline" size={32} /><Text style={styles.emptyTitle}>Este préstamo no admite pagos</Text><Pressable onPress={() => router.back()} style={styles.textButton}><Text style={styles.textButtonLabel}>Volver</Text></Pressable></SafeAreaView>;

  return <SafeAreaView edges={['top']} style={styles.safe}>
    <CarryModal loading={mutation.isPending} onCancel={() => setCarryPrompt(null)} onDecision={(carry) => carryPrompt && mutation.mutate({ values: carryPrompt.values, carry })} remaining={carryPrompt?.remaining ?? '0.00'} visible={Boolean(carryPrompt)} />
    <View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Registrar pago</Text><View style={styles.topButton} /></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.loanHeader}><View style={styles.clientIcon}><Ionicons color={colors.primary} name="person-outline" size={20} /></View><View style={styles.loanCopy}><Text style={styles.clientName}>{loan.cliente_nombre}</Text><Text style={styles.loanMeta}>Saldo total: {formatMoneyText(loan.saldo_pendiente, true)}</Text></View><View style={styles.secure}><Ionicons color={colors.success} name="shield-checkmark" size={16} /></View></View>

      <View style={styles.modeCard}><Text style={styles.blockTitle}>¿Qué deseas registrar?</Text><View style={styles.modeTabs}><ModeButton active={mode === 'CUOTA'} icon="calendar-outline" label={`Cuota ${currentInstallment.numero}`} onPress={() => setMode('CUOTA')} /><ModeButton active={mode === 'TOTAL'} icon="checkmark-done-outline" label="Pagar saldo total" onPress={() => setMode('TOTAL')} /></View></View>

      <View style={styles.installmentCard}><View style={styles.installmentTop}><View><Text style={styles.caption}>{mode === 'TOTAL' ? 'SALDO DEL PRÉSTAMO' : `CUOTA ${currentInstallment.numero} DE ${loan.numero_cuotas}`}</Text><Text style={styles.installmentAmount}>{formatMoneyText(mode === 'TOTAL' ? loan.saldo_pendiente : currentInstallment.saldo_pendiente, true)}</Text></View><View style={[styles.statePill, currentInstallment.estado === 'PARCIAL' && styles.partialPill]}><Text style={[styles.stateText, currentInstallment.estado === 'PARCIAL' && styles.partialText]}>{mode === 'TOTAL' ? 'TOTAL' : currentInstallment.estado === 'PARCIAL' ? 'PARCIAL' : 'PENDIENTE'}</Text></View></View>{mode === 'CUOTA' && currentInstallment.estado === 'PARCIAL' ? <Text style={styles.partialHint}>Ya recibiste {formatMoneyText(currentInstallment.monto_pagado, true)} para esta cuota.</Text> : null}</View>

      <View style={styles.formCard}>
        <View style={styles.field}><Text style={styles.label}>Monto recibido</Text><Controller control={control} name="monto" render={({ field: { onBlur, onChange, value } }) => <View style={[styles.moneyInput, errors.monto && styles.inputError, mode === 'TOTAL' && styles.lockedInput]}><Text style={styles.currency}>S/</Text><TextInput editable={mode !== 'TOTAL'} keyboardType="decimal-pad" onBlur={onBlur} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, '').replace(',', '.'))} placeholder="0.00" placeholderTextColor={colors.textMuted} style={styles.moneyText} value={value} />{mode === 'TOTAL' ? <Ionicons color={colors.success} name="lock-closed" size={17} /> : null}</View>} />{errors.monto ? <Text style={styles.error}>{errors.monto.message}</Text> : null}<Text style={styles.helper}>{mode === 'TOTAL' ? 'El importe está fijado para evitar saldos negativos.' : 'Puedes registrar el monto completo o un pago parcial.'}</Text></View>
        <View style={styles.field}><Text style={styles.label}>¿Cómo recibiste el dinero?</Text><Controller control={control} name="medio" render={({ field: { onChange, value } }) => <View style={styles.methodGrid}>{methods.map((method) => <Pressable key={method} onPress={() => onChange(method)} style={[styles.method, value === method && styles.methodActive]}><Ionicons color={value === method ? colors.primary : colors.textMuted} name={method === 'EFECTIVO' ? 'cash-outline' : method === 'YAPE' || method === 'PLIN' ? 'phone-portrait-outline' : 'card-outline'} size={16} /><Text style={[styles.methodText, value === method && styles.methodTextActive]}>{method.charAt(0) + method.slice(1).toLowerCase()}</Text></Pressable>)}</View>} /></View>
        <View style={styles.field}><Text style={styles.label}>Nota opcional</Text><Controller control={control} name="nota" render={({ field: { onBlur, onChange, value } }) => <TextInput multiline onBlur={onBlur} onChangeText={onChange} placeholder="Ej. Transferencia recibida por Yape" placeholderTextColor={colors.textMuted} style={styles.note} value={value} />} />{errors.nota ? <Text style={styles.error}>{errors.nota.message}</Text> : null}</View>
      </View>

      <View style={styles.audit}><View style={styles.auditIcon}><Ionicons color={colors.primary} name="time-outline" size={19} /></View><View style={styles.auditCopy}><Text style={styles.auditTitle}>Fecha automática</Text><Text style={styles.auditText}>Se guardará la fecha y hora exactas cuando confirmes. El ingreso también aparecerá en Caja.</Text></View></View>
      <Pressable disabled={mutation.isPending} onPress={handleSubmit(submit)} style={({ pressed }) => [styles.submit, (pressed || mutation.isPending) && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={20} /><Text style={styles.submitText}>{mode === 'TOTAL' ? 'Confirmar pago total' : 'Registrar pago'}</Text></>}</Pressable>
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView>;
}

function ModeButton({ active, icon, label, onPress }: { active: boolean; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Ionicons color={active ? colors.primary : colors.textMuted} name={icon} size={18} /><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>{active ? <Ionicons color={colors.primary} name="checkmark-circle" size={16} /> : null}</Pressable>;
}

function CarryModal({ visible, remaining, loading, onDecision, onCancel }: { visible: boolean; remaining: string; loading: boolean; onDecision: (carry: boolean) => void; onCancel: () => void }) {
  return <Modal animationType="fade" onRequestClose={onCancel} statusBarTranslucent transparent visible={visible}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.carryIcon}><Ionicons color={colors.primary} name="arrow-forward-circle-outline" size={30} /></View><Text style={styles.modalTitle}>¿Pasar lo restante?</Text><Text style={styles.modalText}>Faltan <Text style={styles.modalStrong}>{formatMoneyText(remaining, true)}</Text> de esta cuota. Puedes sumarlo a la siguiente o dejar esta cuota parcial.</Text><View style={styles.decisionPreview}><DecisionLine color={colors.success} label="Sí" text="Cierra esta cuota y aumenta la siguiente." /><DecisionLine color={colors.danger} label="No" text="La cuota queda parcial para completarla después." /></View><Pressable disabled={loading} onPress={() => onDecision(true)} style={[styles.decisionButton, styles.yesButton]}><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /><Text style={styles.decisionButtonText}>Sí, pasar a la siguiente</Text></Pressable><Pressable disabled={loading} onPress={() => onDecision(false)} style={[styles.decisionButton, styles.noButton]}><Ionicons color="#FFFFFF" name="pause-outline" size={18} /><Text style={styles.decisionButtonText}>No, dejarla parcial</Text></Pressable><Pressable disabled={loading} onPress={onCancel} style={styles.cancelDecision}><Text style={styles.cancelDecisionText}>Volver y revisar</Text></Pressable></View></View></Modal>;
}

function DecisionLine({ color, label, text }: { color: string; label: string; text: string }) { return <View style={styles.decisionLine}><View style={[styles.decisionDot, { backgroundColor: color }]} /><Text style={styles.decisionCopy}><Text style={[styles.decisionLabel, { color }]}>{label}: </Text>{text}</Text></View>; }

function PaymentSuccessModal({ visible, amount, method, onContinue }: { visible: boolean; amount: string; method: string; onContinue: () => void }) {
  return <Modal animationType="fade" onRequestClose={onContinue} statusBarTranslucent transparent visible={visible}><View style={styles.successBackdrop}><View style={styles.successCard}><View style={styles.successIcon}><Ionicons color="#FFFFFF" name="checkmark" size={35} /></View><Text style={styles.successTitle}>Pago registrado</Text><Text style={styles.successAmount}>{formatMoneyText(amount, true)}</Text><Text style={styles.successMeta}>{method.charAt(0) + method.slice(1).toLowerCase()} · guardado en Caja</Text><View style={styles.successNotice}><Ionicons color={colors.success} name="shield-checkmark-outline" size={18} /><Text style={styles.successNoticeText}>El saldo y las cuotas se actualizaron automáticamente.</Text></View><Pressable onPress={onContinue} style={styles.successButton}><Text style={styles.successButtonText}>Ver préstamo actualizado</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={19} /></Pressable></View></View></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl }, loadingText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.medium }, emptyTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, textButton: { padding: spacing.md }, textButtonLabel: { color: colors.primary, fontSize: 14, fontFamily: fonts.bold },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, scroll: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: 48, gap: spacing.xl, boxSizing: 'border-box' },
  loanHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, clientIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, loanCopy: { flex: 1 }, clientName: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, loanMeta: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium, marginTop: 4 }, secure: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  modeCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md, ...shadows.card }, blockTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.extraBold }, modeTabs: { flexDirection: 'row', gap: spacing.sm }, modeButton: { flex: 1, minHeight: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, modeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, modeText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.semibold }, modeTextActive: { color: colors.primary, fontFamily: fonts.bold },
  installmentCard: { borderRadius: radii.xl, backgroundColor: colors.navy, padding: spacing.xl, ...shadows.card }, installmentTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, caption: { color: '#FFFFFF8F', fontSize: 11, fontFamily: fonts.extraBold, letterSpacing: 1 }, installmentAmount: { color: '#FFFFFF', fontSize: 31, fontFamily: fonts.extraBold, marginTop: 5, fontVariant: ['tabular-nums'] }, statePill: { backgroundColor: '#FFFFFF17', borderRadius: radii.round, paddingHorizontal: 9, paddingVertical: 6 }, partialPill: { backgroundColor: '#F2A23B25' }, stateText: { color: '#FFFFFFB8', fontSize: 10, fontFamily: fonts.extraBold }, partialText: { color: '#FFC875' }, partialHint: { color: '#FFFFFFA8', fontSize: 11, fontFamily: fonts.medium, marginTop: spacing.md },
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.xl, ...shadows.card }, field: { gap: spacing.sm }, label: { color: colors.text, fontSize: 14, fontFamily: fonts.bold }, moneyInput: { minHeight: 66, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, lockedInput: { borderColor: '#BDEAD7', backgroundColor: colors.successSoft }, inputError: { borderColor: colors.danger }, currency: { color: colors.primary, fontSize: 18, fontFamily: fonts.extraBold }, moneyText: { flex: 1, color: colors.text, fontSize: 26, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] }, error: { color: colors.danger, fontSize: 12, lineHeight: 18, fontFamily: fonts.medium }, helper: { color: colors.textMuted, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular }, methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, method: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }, methodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, methodText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.semibold }, methodTextActive: { color: colors.primary }, note: { minHeight: 78, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: spacing.md, color: colors.text, fontSize: 13, fontFamily: fonts.regular, textAlignVertical: 'top' },
  audit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.primarySoft }, auditIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, auditCopy: { flex: 1 }, auditTitle: { color: colors.primaryDark, fontSize: 13, fontFamily: fonts.bold }, auditText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, marginTop: 3 }, submit: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, submitText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.bold }, disabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: '#10142699', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, modalCard: { width: '100%', maxWidth: 420, borderRadius: radii.xl, backgroundColor: colors.surface, padding: spacing.xl, alignItems: 'center', ...shadows.card }, carryIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, modalTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.extraBold }, modalText: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, fontFamily: fonts.regular, textAlign: 'center', marginTop: spacing.sm }, modalStrong: { color: colors.text, fontFamily: fonts.extraBold }, decisionPreview: { width: '100%', borderRadius: radii.md, backgroundColor: colors.background, padding: spacing.md, gap: spacing.sm, marginVertical: spacing.lg }, decisionLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, decisionDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4 }, decisionCopy: { flex: 1, color: colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular }, decisionLabel: { fontFamily: fonts.extraBold }, decisionButton: { width: '100%', minHeight: 49, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, yesButton: { backgroundColor: colors.success }, noButton: { backgroundColor: colors.danger }, decisionButtonText: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.bold }, cancelDecision: { padding: spacing.md }, cancelDecisionText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.semibold },
  successBackdrop: { flex: 1, backgroundColor: '#10142699', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, successCard: { width: '100%', maxWidth: 390, borderRadius: radii.xl, backgroundColor: colors.surface, padding: spacing.xxl, alignItems: 'center', ...shadows.card }, successIcon: { width: 70, height: 70, borderRadius: 25, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }, successTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.extraBold }, successAmount: { color: colors.success, fontSize: 32, fontFamily: fonts.extraBold, marginTop: spacing.sm, fontVariant: ['tabular-nums'] }, successMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium, marginTop: 4 }, successNotice: { width: '100%', borderRadius: radii.md, backgroundColor: colors.successSoft, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xl }, successNoticeText: { flex: 1, color: colors.success, fontSize: 11, lineHeight: 17, fontFamily: fonts.semibold }, successButton: { width: '100%', minHeight: 52, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, successButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bold },
});
