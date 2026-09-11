import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { getCashSummary } from '@/features/caja/api';
import { compareMoneyText, subtractMoneyText } from '@/features/pagos/schema';
import { calculateLoanPreview } from '@/features/prestamos/schema';
import { getLoansSummary } from '@/features/prestamos/api';
import { renewLoan } from '@/features/renovaciones/api';
import { renewalFormSchema, type RenewalFormValues } from '@/features/renovaciones/schema';
import { formatMoneyText, formatPercentageText } from '@/utils/money';

const methods = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'] as const;

type ConfirmedRenewal = {
  loanId: string;
  base: string;
  compensated: string;
  disbursed: string;
  interest: string;
  total: string;
};

export default function RenewLoanScreen() {
  const { prestamoId = '' } = useLocalSearchParams<{ prestamoId?: string }>();
  const queryClient = useQueryClient();
  const requestId = useRef(Crypto.randomUUID());
  const [confirmed, setConfirmed] = useState<ConfirmedRenewal | null>(null);
  const loansQuery = useQuery({ queryKey: ['prestamos'], queryFn: () => getLoansSummary() });
  const cashQuery = useQuery({ queryKey: ['caja'], queryFn: getCashSummary });
  const loan = loansQuery.data?.prestamos.find((item) => item.id === prestamoId);
  const pendingInstallments = loan?.cuotas.filter((installment) => installment.estado !== 'PAGADA') ?? [];
  const renewalEligible = Boolean(loan && pendingInstallments.length === 1 && pendingInstallments[0].numero === loan.numero_cuotas);
  const { control, handleSubmit, setError, setValue, formState: { errors } } = useForm<RenewalFormValues>({
    resolver: zodResolver(renewalFormSchema),
    defaultValues: { montoBase: '', porcentajeInteres: '20', numeroCuotas: 4, medioDesembolso: 'EFECTIVO', nota: '' },
  });
  const values = useWatch({ control });
  const preview = useMemo(() => calculateLoanPreview(values.montoBase ?? '', values.porcentajeInteres ?? '', values.numeroCuotas ?? 4), [values.montoBase, values.numeroCuotas, values.porcentajeInteres]);
  const disbursed = loan && preview && compareMoneyText(preview.amount, loan.saldo_pendiente) > 0n ? subtractMoneyText(preview.amount, loan.saldo_pendiente) : '0.00';

  useEffect(() => {
    if (!loan) return;
    const method = methods.includes(loan.medio_desembolso as typeof methods[number]) ? loan.medio_desembolso as typeof methods[number] : 'EFECTIVO';
    setValue('medioDesembolso', method);
  }, [loan, setValue]);

  const mutation = useMutation({
    mutationFn: (formValues: RenewalFormValues) => renewLoan(prestamoId, formValues, requestId.current),
    onSuccess: async (newLoanId, formValues) => {
      const finalPreview = calculateLoanPreview(formValues.montoBase, formValues.porcentajeInteres, formValues.numeroCuotas);
      if (loan && finalPreview) {
        setConfirmed({
          loanId: String(newLoanId), base: finalPreview.amount, compensated: loan.saldo_pendiente,
          disbursed: subtractMoneyText(finalPreview.amount, loan.saldo_pendiente), interest: finalPreview.interest, total: finalPreview.total,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prestamos'] }),
        queryClient.invalidateQueries({ queryKey: ['caja'] }),
        queryClient.invalidateQueries({ queryKey: ['clientes'] }),
        queryClient.invalidateQueries({ queryKey: ['actividad'] }),
      ]);
    },
    onError: (error) => setError('montoBase', { message: error.message }),
  });

  function submit(formValues: RenewalFormValues) {
    if (!loan || !preview) return;
    if (compareMoneyText(preview.amount, loan.saldo_pendiente) <= 0n) {
      setError('montoBase', { message: `Debe ser mayor al saldo anterior de ${formatMoneyText(loan.saldo_pendiente, true)}.` });
      return;
    }
    if (compareMoneyText(disbursed, cashQuery.data?.saldo ?? '0.00') > 0n) {
      setError('montoBase', { message: `Caja insuficiente: debes entregar ${formatMoneyText(disbursed, true)}.` });
      return;
    }
    mutation.mutate(formValues);
  }

  if (confirmed) return <SafeAreaView style={styles.safe}><RenewalSuccess data={confirmed} onContinue={() => router.replace({ pathname: '/prestamo/[id]', params: { id: confirmed.loanId } })} /></SafeAreaView>;
  if (loansQuery.isPending || cashQuery.isPending) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.loadingText}>Preparando renovación…</Text></SafeAreaView>;
  if (!loan || loan.estado !== 'ACTIVO' || !renewalEligible) return <SafeAreaView style={styles.center}><Ionicons color={colors.warning} name="alert-circle-outline" size={32} /><Text style={styles.emptyTitle}>Este préstamo todavía no se puede renovar</Text><Text style={styles.loadingText}>Primero deben quedar pagadas todas las cuotas anteriores a la última.</Text><Pressable onPress={() => router.back()} style={styles.backAction}><Text style={styles.backActionText}>Volver</Text></Pressable></SafeAreaView>;

  return <SafeAreaView edges={['top']} style={styles.safe}>
    <View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Renovar préstamo</Text><View style={styles.topButton} /></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.intro}><View style={styles.introIcon}><Ionicons color="#FFFFFF" name="refresh" size={23} /></View><View style={styles.introCopy}><Text style={styles.introTitle}>Renovación con compensación</Text><Text style={styles.introText}>El saldo anterior se descuenta del nuevo monto. Solo el desembolso real sale de Caja.</Text></View><Ionicons color="#FFFFFFA8" name="shield-checkmark-outline" size={20} /></View>

      <View style={styles.previousCard}><View><Text style={styles.caption}>PRÉSTAMO ACTUAL</Text><Text style={styles.client}>{loan.cliente_nombre}</Text></View><View style={styles.previousRight}><Text style={styles.previousLabel}>Saldo a compensar</Text><Text style={styles.previousAmount}>{formatMoneyText(loan.saldo_pendiente, true)}</Text></View></View>

      <View style={styles.formCard}>
        <View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>1</Text></View><View><Text style={styles.sectionTitle}>Nuevo préstamo</Text><Text style={styles.sectionSubtitle}>El interés se aplica sobre este monto completo</Text></View></View>
        <View style={styles.field}><Text style={styles.label}>Nuevo monto solicitado *</Text><Controller control={control} name="montoBase" render={({ field: { onBlur, onChange, value } }) => <View style={[styles.moneyInput, errors.montoBase && styles.inputError]}><Text style={styles.currency}>S/</Text><TextInput keyboardType="decimal-pad" onBlur={onBlur} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, '').replace(',', '.'))} placeholder="500.00" placeholderTextColor={colors.textMuted} style={styles.moneyText} value={value} /></View>} />{errors.montoBase ? <Text style={styles.error}>{errors.montoBase.message}</Text> : <Text style={styles.helper}>Debe ser mayor que {formatMoneyText(loan.saldo_pendiente, true)}.</Text>}</View>
        <View style={styles.field}><Text style={styles.label}>Interés del nuevo préstamo *</Text><Controller control={control} name="porcentajeInteres" render={({ field: { onBlur, onChange, value } }) => <View style={styles.rateChips}>{['10', '15', '20'].map((rate) => <Pressable key={rate} onPress={() => onChange(rate)} style={[styles.rateChip, value === rate && styles.rateChipActive]}><Text style={[styles.rateText, value === rate && styles.rateTextActive]}>{rate}%</Text></Pressable>)}<View style={[styles.customRate, !['10', '15', '20'].includes(value) && styles.customRateActive]}><TextInput keyboardType="decimal-pad" onBlur={onBlur} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, '').replace(',', '.'))} placeholder="Otro" placeholderTextColor={colors.textMuted} style={styles.customInput} value={['10', '15', '20'].includes(value) ? '' : value} /><Text style={styles.percent}>%</Text></View></View>} />{errors.porcentajeInteres ? <Text style={styles.error}>{errors.porcentajeInteres.message}</Text> : null}</View>
        <View style={styles.field}><Text style={styles.label}>Número de cuotas</Text><Controller control={control} name="numeroCuotas" render={({ field: { onChange, value } }) => <View style={styles.counter}><Pressable disabled={value <= 1} onPress={() => onChange(value - 1)} style={[styles.counterButton, value <= 1 && styles.disabled]}><Ionicons color={colors.primary} name="remove" size={20} /></Pressable><View style={styles.counterCopy}><Text style={styles.counterNumber}>{value}</Text><Text style={styles.counterLabel}>cuotas</Text></View><Pressable disabled={value >= 60} onPress={() => onChange(value + 1)} style={[styles.counterButton, value >= 60 && styles.disabled]}><Ionicons color={colors.primary} name="add" size={20} /></Pressable></View>} /></View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>2</Text></View><View><Text style={styles.sectionTitle}>Entrega</Text><Text style={styles.sectionSubtitle}>Cómo recibirá el nuevo desembolso</Text></View></View>
        <Controller control={control} name="medioDesembolso" render={({ field: { onChange, value } }) => <View style={styles.methodGrid}>{methods.map((method) => <Pressable key={method} onPress={() => onChange(method)} style={[styles.method, value === method && styles.methodActive]}><Ionicons color={value === method ? colors.primary : colors.textMuted} name={method === 'EFECTIVO' ? 'cash-outline' : method === 'YAPE' || method === 'PLIN' ? 'phone-portrait-outline' : 'card-outline'} size={16} /><Text style={[styles.methodText, value === method && styles.methodTextActive]}>{method.charAt(0) + method.slice(1).toLowerCase()}</Text></Pressable>)}</View>} />
        <Controller control={control} name="nota" render={({ field: { onBlur, onChange, value } }) => <TextInput multiline onBlur={onBlur} onChangeText={onChange} placeholder="Nota opcional de la renovación…" placeholderTextColor={colors.textMuted} style={styles.note} value={value} />} />{errors.nota ? <Text style={styles.error}>{errors.nota.message}</Text> : null}
      </View>

      <View style={styles.calculation}><View style={styles.calculationHeader}><View style={styles.calculationIcon}><Ionicons color={colors.primary} name="calculator-outline" size={20} /></View><View><Text style={styles.calculationTitle}>Así queda la renovación</Text><Text style={styles.calculationSubtitle}>Cálculo previo y transparente</Text></View></View>
        <CalculationRow label="Nuevo monto solicitado" value={formatMoneyText(preview?.amount ?? '0.00', true)} />
        <CalculationRow danger label="(−) Saldo anterior compensado" value={`− ${formatMoneyText(loan.saldo_pendiente, true)}`} />
        <View style={styles.rule} /><CalculationRow success label="Dinero que recibe el cliente" value={formatMoneyText(disbursed, true)} />
        <View style={styles.explanation}><Ionicons color={colors.primary} name="information-circle-outline" size={17} /><Text style={styles.explanationText}>El interés no se calcula sobre {formatMoneyText(disbursed, true)}, sino sobre el nuevo monto completo.</Text></View>
        <CalculationRow label={`Interés nuevo (${formatPercentageText(values.porcentajeInteres || '0')})`} value={formatMoneyText(preview?.interest ?? '0.00', true)} />
        <View style={styles.totalRule} /><CalculationRow strong label="Nuevo total a cobrar" value={formatMoneyText(preview?.total ?? '0.00', true)} />
      </View>

      <View style={styles.cashNotice}><Ionicons color={colors.success} name="wallet-outline" size={19} /><View style={styles.cashCopy}><Text style={styles.cashTitle}>Caja disponible: {formatMoneyText(cashQuery.data?.saldo ?? '0.00', true)}</Text><Text style={styles.cashText}>Al confirmar solo se descontará {formatMoneyText(disbursed, true)}.</Text></View></View>
      <View style={styles.atomic}><Ionicons color={colors.primary} name="shield-checkmark-outline" size={20} /><Text style={styles.atomicText}>Todo se procesa junto. Si falla la compensación, el nuevo préstamo, las cuotas o el desembolso, no se guarda ningún cambio.</Text></View>
      <Pressable disabled={mutation.isPending} onPress={handleSubmit(submit)} style={({ pressed }) => [styles.submit, (pressed || mutation.isPending) && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="refresh-circle-outline" size={21} /><Text style={styles.submitText}>Confirmar renovación</Text></>}</Pressable>
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView>;
}

function CalculationRow({ label, value, danger = false, success = false, strong = false }: { label: string; value: string; danger?: boolean; success?: boolean; strong?: boolean }) { return <View style={styles.calculationRow}><Text style={[styles.calculationLabel, danger && styles.danger, success && styles.success, strong && styles.strong]}>{label}</Text><Text style={[styles.calculationValue, danger && styles.danger, success && styles.success, strong && styles.total]}>{value}</Text></View>; }

function RenewalSuccess({ data, onContinue }: { data: ConfirmedRenewal | null; onContinue: () => void }) {
  return <Modal animationType="fade" onRequestClose={onContinue} statusBarTranslucent transparent visible={Boolean(data)}><View style={styles.successBackdrop}>{data ? <View style={styles.successCard}><View style={styles.successIcon}><Ionicons color="#FFFFFF" name="refresh" size={31} /></View><Text style={styles.successTitle}>Renovación completada</Text><Text style={styles.successSubtitle}>El préstamo anterior quedó compensado.</Text><View style={styles.successSummary}><CalculationRow label="Nuevo préstamo" value={formatMoneyText(data.base, true)} /><CalculationRow danger label="Saldo compensado" value={`− ${formatMoneyText(data.compensated, true)}`} /><View style={styles.rule} /><CalculationRow success label="Dinero entregado" value={formatMoneyText(data.disbursed, true)} /><CalculationRow label="Interés nuevo" value={formatMoneyText(data.interest, true)} /><CalculationRow strong label="Total a cobrar" value={formatMoneyText(data.total, true)} /></View><Pressable onPress={onContinue} style={styles.successButton}><Text style={styles.successButtonText}>Ver nuevo préstamo</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={19} /></Pressable></View> : null}</View></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl }, loadingText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.medium }, emptyTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, backAction: { padding: spacing.md }, backActionText: { color: colors.primary, fontSize: 13, fontFamily: fonts.bold },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, scroll: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: 48, gap: spacing.xl, boxSizing: 'border-box' },
  intro: { borderRadius: radii.xl, backgroundColor: colors.navy, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.card }, introIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#FFFFFF1A', alignItems: 'center', justifyContent: 'center' }, introCopy: { flex: 1 }, introTitle: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.extraBold }, introText: { color: '#FFFFFFA8', fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, marginTop: 4 },
  previousCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, ...shadows.card }, caption: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.extraBold, letterSpacing: 1 }, client: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold, marginTop: 4 }, previousRight: { alignItems: 'flex-end' }, previousLabel: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium }, previousAmount: { color: colors.danger, fontSize: 18, fontFamily: fonts.extraBold, marginTop: 3, fontVariant: ['tabular-nums'] },
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.xl, ...shadows.card }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, step: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, stepText: { color: colors.primary, fontSize: 15, fontFamily: fonts.extraBold }, sectionTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold }, sectionSubtitle: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, marginTop: 3 }, field: { gap: spacing.sm }, label: { color: colors.text, fontSize: 14, fontFamily: fonts.bold }, moneyInput: { minHeight: 66, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, inputError: { borderColor: colors.danger }, currency: { color: colors.primary, fontSize: 18, fontFamily: fonts.extraBold }, moneyText: { flex: 1, color: colors.text, fontSize: 26, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] }, error: { color: colors.danger, fontSize: 12, lineHeight: 18, fontFamily: fonts.medium }, helper: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular },
  rateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, rateChip: { minWidth: 62, height: 43, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, rateChipActive: { borderColor: colors.primary, backgroundColor: colors.primary }, rateText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.bold }, rateTextActive: { color: '#FFFFFF' }, customRate: { minWidth: 92, height: 43, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, backgroundColor: colors.background }, customRateActive: { borderColor: colors.primary }, customInput: { flex: 1, color: colors.text, fontSize: 13, fontFamily: fonts.bold, textAlign: 'center' }, percent: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bold },
  counter: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm }, counterButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, counterCopy: { alignItems: 'center' }, counterNumber: { color: colors.text, fontSize: 19, fontFamily: fonts.extraBold }, counterLabel: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium }, disabled: { opacity: 0.45 }, methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, method: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }, methodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, methodText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.semibold }, methodTextActive: { color: colors.primary }, note: { minHeight: 80, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: spacing.md, color: colors.text, fontSize: 13, fontFamily: fonts.regular, textAlignVertical: 'top' },
  calculation: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.md, borderWidth: 1.5, borderColor: '#DCD6FF', ...shadows.card }, calculationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs }, calculationIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, calculationTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, calculationSubtitle: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, marginTop: 3 }, calculationRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, calculationLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium }, calculationValue: { color: colors.text, fontSize: 13, fontFamily: fonts.bold, fontVariant: ['tabular-nums'] }, danger: { color: colors.danger }, success: { color: colors.success }, strong: { color: colors.text, fontFamily: fonts.extraBold }, total: { color: colors.primary, fontSize: 17, fontFamily: fonts.extraBold }, rule: { height: 1, backgroundColor: colors.border }, totalRule: { height: 1, backgroundColor: colors.primarySoft }, explanation: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: spacing.md }, explanationText: { flex: 1, color: colors.primaryDark, fontSize: 11, lineHeight: 17, fontFamily: fonts.medium },
  cashNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.successSoft, borderRadius: radii.lg, padding: spacing.lg }, cashCopy: { flex: 1 }, cashTitle: { color: colors.success, fontSize: 13, fontFamily: fonts.bold }, cashText: { color: colors.textSecondary, fontSize: 11, fontFamily: fonts.regular, marginTop: 3 }, atomic: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radii.lg, padding: spacing.lg }, atomicText: { flex: 1, color: colors.primaryDark, fontSize: 11, lineHeight: 18, fontFamily: fonts.medium }, submit: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, submitText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.bold },
  successBackdrop: { flex: 1, backgroundColor: '#10142699', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, successCard: { width: '100%', maxWidth: 410, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xxl, alignItems: 'center', ...shadows.card }, successIcon: { width: 67, height: 67, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }, successTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.extraBold }, successSubtitle: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.regular, marginTop: 4 }, successSummary: { width: '100%', backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, marginVertical: spacing.xl }, successButton: { width: '100%', minHeight: 52, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, successButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bold },
});
