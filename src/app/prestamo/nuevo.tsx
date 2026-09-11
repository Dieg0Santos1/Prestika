import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { LoanSuccessReceipt, type LoanReceipt } from '@/components/loan-success-receipt';
import { getCashSummary } from '@/features/caja/api';
import { listClients } from '@/features/clientes/api';
import { createLoan, getLoansSummary } from '@/features/prestamos/api';
import { calculateLoanPreview, loanFormSchema, type LoanFormValues } from '@/features/prestamos/schema';
import { formatMoneyText, moneyTextToCents } from '@/utils/money';

const methods = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'] as const;

export default function NewLoanScreen() {
  const { clienteId = '' } = useLocalSearchParams<{ clienteId?: string }>();
  const queryClient = useQueryClient();
  const requestId = useRef(Crypto.randomUUID());
  const [receipt, setReceipt] = useState<LoanReceipt | null>(null);
  const clientsQuery = useQuery({ queryKey: ['clientes'], queryFn: listClients });
  const loansQuery = useQuery({ queryKey: ['prestamos'], queryFn: () => getLoansSummary() });
  const cashQuery = useQuery({ queryKey: ['caja'], queryFn: getCashSummary });
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: { clienteId, montoBase: '', porcentajeInteres: '20', numeroCuotas: 4, medioDesembolso: 'EFECTIVO', nota: '' },
  });
  const values = useWatch({ control });
  const preview = useMemo(() => calculateLoanPreview(values.montoBase ?? '', values.porcentajeInteres ?? '', values.numeroCuotas ?? 4), [values.montoBase, values.numeroCuotas, values.porcentajeInteres]);
  const activeClientIds = useMemo(() => new Set((loansQuery.data?.prestamos ?? []).filter((loan) => loan.estado === 'ACTIVO').map((loan) => loan.cliente_id)), [loansQuery.data]);
  const eligibleClients = (clientsQuery.data ?? []).filter((client) => client.estado === 'ACTIVO' && !activeClientIds.has(client.id));
  const selectedClient = (clientsQuery.data ?? []).find((client) => client.id === values.clienteId);
  const requestedCents = moneyTextToCents(values.montoBase ?? '');
  const availableCents = moneyTextToCents(cashQuery.data?.saldo ?? '0.00');
  const insufficientFunds = cashQuery.isSuccess
    && requestedCents !== null
    && availableCents !== null
    && requestedCents > availableCents;

  useEffect(() => {
    if (!selectedClient?.metodo_pago_preferido) return;
    const preferred = selectedClient.metodo_pago_preferido;
    if (methods.includes(preferred as typeof methods[number])) setValue('medioDesembolso', preferred as typeof methods[number]);
  }, [selectedClient, setValue]);

  const mutation = useMutation({
    mutationFn: (formValues: LoanFormValues) => createLoan(formValues, requestId.current),
    onSuccess: async (loanId, formValues) => {
      const confirmedPreview = calculateLoanPreview(formValues.montoBase, formValues.porcentajeInteres, formValues.numeroCuotas);
      const confirmedClient = (clientsQuery.data ?? []).find((client) => client.id === formValues.clienteId);
      if (confirmedPreview) {
        setReceipt({
          loanId: String(loanId),
          clientName: confirmedClient ? `${confirmedClient.nombres} ${confirmedClient.apellidos ?? ''}`.trim() : 'Cliente',
          values: formValues,
          preview: confirmedPreview,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prestamos'] }),
        queryClient.invalidateQueries({ queryKey: ['caja'] }),
        queryClient.invalidateQueries({ queryKey: ['clientes'] }),
        queryClient.invalidateQueries({ queryKey: ['actividad'] }),
      ]);
    },
    onError: (error) => Alert.alert('No se pudo crear el préstamo', error.message),
  });

  return <SafeAreaView edges={['top']} style={styles.safe}><LoanSuccessReceipt onContinue={() => receipt && router.replace({ pathname: '/prestamo/[id]', params: { id: receipt.loanId } })} receipt={receipt} /><View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Nuevo préstamo</Text><View style={styles.topButton} /></View><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.progress}><View style={styles.progressDone} /><Text style={styles.progressText}>CONFIGURACIÓN Y CONFIRMACIÓN</Text></View>

    <View style={styles.section}><View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>1</Text></View><View><Text style={styles.sectionTitle}>Cliente</Text><Text style={styles.sectionSubtitle}>Selecciona quién recibirá el dinero</Text></View></View>
      {clientsQuery.isPending || loansQuery.isPending ? <ActivityIndicator color={colors.primary} /> : <View style={styles.clientGrid}>{eligibleClients.map((client) => { const selected = values.clienteId === client.id; const initials = `${client.nombres.at(0) ?? ''}${client.apellidos?.at(0) ?? ''}`.toUpperCase(); return <Pressable key={client.id} onPress={() => setValue('clienteId', client.id, { shouldValidate: true })} style={[styles.clientChoice, selected && styles.clientChoiceActive]}><View style={[styles.avatar, selected && styles.avatarActive]}><Text style={[styles.avatarText, selected && styles.avatarTextActive]}>{initials}</Text></View><View style={styles.clientCopy}><Text numberOfLines={1} style={styles.clientName}>{client.nombres} {client.apellidos}</Text><Text style={styles.clientMeta}>{client.metodo_pago_preferido || 'Sin medio preferido'}</Text></View>{selected ? <Ionicons color={colors.primary} name="checkmark-circle" size={21} /> : null}</Pressable>; })}</View>}
      {eligibleClients.length === 0 && clientsQuery.isSuccess && loansQuery.isSuccess ? <View style={styles.inlineEmpty}><Ionicons color={colors.warning} name="people-outline" size={21} /><Text style={styles.inlineEmptyText}>No hay clientes activos disponibles sin préstamo vigente.</Text></View> : null}
      {errors.clienteId ? <Text style={styles.error}>{errors.clienteId.message}</Text> : null}
    </View>

    <View style={styles.section}><View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>2</Text></View><View><Text style={styles.sectionTitle}>Condiciones</Text><Text style={styles.sectionSubtitle}>Define monto, interés y cuotas</Text></View></View>
      <View style={styles.field}><Text style={styles.label}>Monto del préstamo *</Text><Controller control={control} name="montoBase" render={({ field: { onBlur, onChange, value } }) => <View style={[styles.moneyInput, (errors.montoBase || insufficientFunds) && styles.inputError]}><Text style={[styles.currency, insufficientFunds && styles.insufficientText]}>S/</Text><TextInput keyboardType="decimal-pad" onBlur={onBlur} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, '').replace(',', '.'))} placeholder="500.00" placeholderTextColor={colors.textMuted} style={[styles.moneyText, insufficientFunds && styles.insufficientText]} value={value} /></View>} />{errors.montoBase ? <Text style={styles.error}>{errors.montoBase.message}</Text> : null}{insufficientFunds ? <Text style={styles.error}>El monto supera el dinero disponible en Caja.</Text> : null}<View style={styles.availableLine}><Ionicons color={insufficientFunds ? colors.danger : colors.success} name="wallet-outline" size={16} /><Text style={[styles.available, insufficientFunds && styles.insufficientText]}>Caja disponible: {formatMoneyText(cashQuery.data?.saldo ?? '0.00', true)}</Text></View></View>
      <View style={styles.field}><Text style={styles.label}>Interés *</Text><Controller control={control} name="porcentajeInteres" render={({ field: { onBlur, onChange, value } }) => <><View style={styles.rateChips}>{['10', '15', '20'].map((rate) => <Pressable key={rate} onPress={() => onChange(rate)} style={[styles.rateChip, value === rate && styles.rateChipActive]}><Text style={[styles.rateChipText, value === rate && styles.rateChipTextActive]}>{rate}%</Text></Pressable>)}<View style={[styles.rateInput, !['10', '15', '20'].includes(value) && styles.rateInputActive]}><TextInput keyboardType="decimal-pad" onBlur={onBlur} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, '').replace(',', '.'))} placeholder="Otro" placeholderTextColor={colors.textMuted} style={styles.rateTextInput} value={['10', '15', '20'].includes(value) ? '' : value} /><Text style={styles.percent}>%</Text></View></View></>} />{errors.porcentajeInteres ? <Text style={styles.error}>{errors.porcentajeInteres.message}</Text> : null}</View>
      <View style={styles.field}><Text style={styles.label}>Número de cuotas</Text><Controller control={control} name="numeroCuotas" render={({ field: { onChange, value } }) => <View style={styles.counter}><Pressable accessibilityLabel="Reducir cuotas" disabled={value <= 1} onPress={() => onChange(value - 1)} style={[styles.counterButton, value <= 1 && styles.disabled]}><Ionicons color={colors.primary} name="remove" size={20} /></Pressable><View style={styles.counterValue}><Text style={styles.counterNumber}>{value}</Text><Text style={styles.counterLabel}>cuotas</Text></View><Pressable accessibilityLabel="Aumentar cuotas" disabled={value >= 60} onPress={() => onChange(value + 1)} style={[styles.counterButton, value >= 60 && styles.disabled]}><Ionicons color={colors.primary} name="add" size={20} /></Pressable></View>} /><Text style={styles.helper}>Sin fechas de vencimiento. La fecha se registrará cuando recibas cada pago.</Text></View>
    </View>

    <View style={styles.section}><View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>3</Text></View><View><Text style={styles.sectionTitle}>Entrega</Text><Text style={styles.sectionSubtitle}>Registra cómo sale el dinero de Caja</Text></View></View>
      <Controller control={control} name="medioDesembolso" render={({ field: { onChange, value } }) => <View style={styles.methodGrid}>{methods.map((method) => <Pressable key={method} onPress={() => onChange(method)} style={[styles.method, value === method && styles.methodActive]}><Ionicons color={value === method ? colors.primary : colors.textMuted} name={method === 'EFECTIVO' ? 'cash-outline' : method === 'YAPE' || method === 'PLIN' ? 'phone-portrait-outline' : 'card-outline'} size={16} /><Text style={[styles.methodText, value === method && styles.methodTextActive]}>{method.charAt(0) + method.slice(1).toLowerCase()}</Text></Pressable>)}</View>} />
      <Controller control={control} name="nota" render={({ field: { onBlur, onChange, value } }) => <TextInput multiline onBlur={onBlur} onChangeText={onChange} placeholder="Nota opcional del préstamo..." placeholderTextColor={colors.textMuted} style={styles.note} value={value} />} />
    </View>

    <View style={styles.preview}><View style={styles.previewHeader}><View style={styles.previewIcon}><Ionicons color={colors.primary} name="calculator-outline" size={20} /></View><View><Text style={styles.previewTitle}>Resumen del préstamo</Text><Text style={styles.previewSubtitle}>Cálculo previo · PostgreSQL validará al guardar</Text></View></View><SummaryRow label="Monto base" value={formatMoneyText(preview?.amount ?? '0.00', true)} /><SummaryRow label={`Interés (${values.porcentajeInteres || '0'}%)`} value={formatMoneyText(preview?.interest ?? '0.00', true)} /><View style={styles.totalRule} /><SummaryRow strong label="Total a cobrar" value={formatMoneyText(preview?.total ?? '0.00', true)} /><View style={styles.installmentBox}><Ionicons color={colors.primary} name="calendar-outline" size={18} /><View style={styles.installmentCopy}><Text style={styles.installmentLabel}>{values.numeroCuotas ?? 4} cuotas de aproximadamente</Text><Text style={styles.installmentAmount}>{formatMoneyText(preview?.firstInstallment ?? '0.00', true)}</Text>{preview?.hasRoundingDifference ? <Text style={styles.rounding}>La última se ajustará a {formatMoneyText(preview.lastInstallment, true)} por redondeo.</Text> : null}</View></View></View>

    <View style={styles.audit}><Ionicons color={colors.primary} name="shield-checkmark-outline" size={20} /><Text style={styles.auditText}>Al confirmar se crearán el préstamo, sus cuotas y el desembolso de Caja en una sola transacción.</Text></View>
    <Pressable disabled={mutation.isPending || eligibleClients.length === 0 || insufficientFunds || cashQuery.isPending} onPress={handleSubmit((formValues) => mutation.mutate(formValues))} style={({ pressed }) => [styles.submit, (pressed || mutation.isPending || eligibleClients.length === 0 || insufficientFunds || cashQuery.isPending) && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={20} /><Text style={styles.submitText}>{insufficientFunds ? 'Saldo insuficiente en Caja' : 'Crear préstamo y desembolsar'}</Text></>}</Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, strong && styles.strong]}>{label}</Text><Text style={[styles.summaryValue, strong && styles.totalValue]}>{value}</Text></View>; }

const styles = StyleSheet.create({
  insufficientText: { color: colors.danger },
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, scroll: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: 48, gap: spacing.xl, boxSizing: 'border-box' }, progress: { height: 28, justifyContent: 'center' }, progressDone: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, borderRadius: 2, backgroundColor: colors.primary }, progressText: { color: colors.primary, fontSize: 11, fontFamily: fonts.extraBold, letterSpacing: 1.1, marginTop: 10 },
  section: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg, ...shadows.card }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, step: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, stepText: { color: colors.primary, fontSize: 15, fontFamily: fonts.extraBold }, sectionTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold }, sectionSubtitle: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, marginTop: 3 },
  clientGrid: { gap: spacing.sm }, clientChoice: { minHeight: 62, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background }, clientChoiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' }, avatarActive: { backgroundColor: colors.primary }, avatarText: { color: colors.textSecondary, fontSize: 15, fontFamily: fonts.extraBold }, avatarTextActive: { color: '#FFFFFF' }, clientCopy: { flex: 1, minWidth: 0 }, clientName: { color: colors.text, fontSize: 15, fontFamily: fonts.bold }, clientMeta: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium, marginTop: 3 }, inlineEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.warningSoft, borderRadius: radii.md }, inlineEmptyText: { flex: 1, color: colors.warning, fontSize: 13, fontFamily: fonts.semibold },
  field: { gap: spacing.sm }, label: { color: colors.text, fontSize: 14, fontFamily: fonts.bold }, moneyInput: { height: 62, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: spacing.lg }, currency: { color: colors.primary, fontSize: 17, fontFamily: fonts.extraBold, marginRight: spacing.sm }, moneyText: { flex: 1, color: colors.text, fontSize: 25, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 12, fontFamily: fonts.medium }, availableLine: { flexDirection: 'row', alignItems: 'center', gap: 5 }, available: { color: colors.success, fontSize: 12, fontFamily: fonts.semibold }, rateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, rateChip: { minWidth: 60, height: 43, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, rateChipActive: { borderColor: colors.primary, backgroundColor: colors.primary }, rateChipText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.bold }, rateChipTextActive: { color: '#FFFFFF' }, rateInput: { minWidth: 92, height: 43, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, backgroundColor: colors.background }, rateInputActive: { borderColor: colors.primary }, rateTextInput: { flex: 1, color: colors.text, fontSize: 14, fontFamily: fonts.bold, textAlign: 'center' }, percent: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bold }, counter: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm }, counterButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, counterValue: { alignItems: 'center' }, counterNumber: { color: colors.text, fontSize: 19, fontFamily: fonts.extraBold }, counterLabel: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium }, helper: { color: colors.textMuted, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular }, disabled: { opacity: 0.45 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, method: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }, methodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, methodText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.semibold }, methodTextActive: { color: colors.primary }, note: { minHeight: 82, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: spacing.md, color: colors.text, fontSize: 14, fontFamily: fonts.regular, textAlignVertical: 'top' },
  preview: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.md, borderWidth: 1.5, borderColor: '#DCD6FF', ...shadows.card }, previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs }, previewIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, previewTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, previewSubtitle: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, marginTop: 3 }, summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, summaryLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.medium }, summaryValue: { color: colors.text, fontSize: 14, fontFamily: fonts.bold, fontVariant: ['tabular-nums'] }, totalRule: { height: 1, backgroundColor: colors.border }, strong: { color: colors.text, fontFamily: fonts.extraBold }, totalValue: { color: colors.primary, fontSize: 18, fontFamily: fonts.extraBold }, installmentBox: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radii.md }, installmentCopy: { flex: 1 }, installmentLabel: { color: colors.primaryDark, fontSize: 12, fontFamily: fonts.medium }, installmentAmount: { color: colors.primary, fontSize: 16, fontFamily: fonts.extraBold, marginTop: 2 }, rounding: { color: colors.textSecondary, fontSize: 10, fontFamily: fonts.regular, marginTop: 2 },
  audit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.primarySoft }, auditText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 19, fontFamily: fonts.medium }, submit: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, submitText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.bold },
});
