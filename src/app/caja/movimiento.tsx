import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { getCashSummary, registerCashMovement } from '@/features/caja/api';
import { cashMovementSchema, type CashMovementFormValues } from '@/features/caja/schema';
import { formatMoneyText } from '@/utils/money';

const methods = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'] as const;
type ManualType = 'CAPITAL_INICIAL' | 'APORTE_CAPITAL' | 'RETIRO_CAPITAL';

const titles: Record<ManualType, string> = { CAPITAL_INICIAL: 'Definir capital inicial', APORTE_CAPITAL: 'Agregar capital', RETIRO_CAPITAL: 'Retirar capital' };

export default function CashMovementScreen() {
  const params = useLocalSearchParams<{ tipo?: string }>();
  const type: ManualType = params.tipo === 'CAPITAL_INICIAL' || params.tipo === 'RETIRO_CAPITAL' ? params.tipo : 'APORTE_CAPITAL';
  const isWithdrawal = type === 'RETIRO_CAPITAL';
  const queryClient = useQueryClient();
  const requestId = useRef(Crypto.randomUUID());
  const cashQuery = useQuery({ queryKey: ['caja'], queryFn: getCashSummary });
  const { control, handleSubmit, formState: { errors } } = useForm<CashMovementFormValues>({ resolver: zodResolver(cashMovementSchema), defaultValues: { monto: '', medio: 'EFECTIVO', nota: '' } });
  const mutation = useMutation({
    mutationFn: (values: CashMovementFormValues) => registerCashMovement(type, values, requestId.current),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['caja'] }), queryClient.invalidateQueries({ queryKey: ['actividad'] })]); router.back(); },
    onError: (error) => Alert.alert('No se pudo registrar', error.message),
  });

  return <SafeAreaView edges={['top']} style={styles.safe}><View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>{titles[type]}</Text><View style={styles.topButton} /></View><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={[styles.intro, isWithdrawal ? styles.introDanger : styles.introPositive]}><View style={[styles.introIcon, isWithdrawal ? styles.iconDanger : styles.iconPositive]}><Ionicons color={isWithdrawal ? colors.danger : colors.success} name={isWithdrawal ? 'arrow-up-outline' : 'arrow-down-outline'} size={24} /></View><View style={styles.introCopy}><Text style={styles.introTitle}>{isWithdrawal ? 'Salida de tu capital' : type === 'CAPITAL_INICIAL' ? 'Punto de partida de tu caja' : 'Dinero adicional para prestar'}</Text><Text style={styles.introText}>{isWithdrawal ? `Disponible actualmente: ${formatMoneyText(cashQuery.data?.saldo ?? '0.00', true)}. Nunca permitiremos que la caja quede negativa.` : 'Este movimiento modifica la caja, pero no se considera una ganancia ni un cobro de préstamo.'}</Text></View></View>
    <View style={styles.card}>
      <View style={styles.field}><Text style={styles.label}>Monto *</Text><Controller control={control} name="monto" render={({ field: { onBlur, onChange, value } }) => <View style={[styles.moneyInput, errors.monto && styles.inputError]}><Text style={styles.currency}>S/</Text><TextInput autoFocus keyboardType="decimal-pad" onBlur={onBlur} onChangeText={(text) => onChange(text.replace(/[^0-9.,]/g, '').replace(',', '.'))} placeholder="0.00" placeholderTextColor={colors.textMuted} style={styles.moneyText} value={value} /></View>} />{errors.monto ? <Text style={styles.error}>{errors.monto.message}</Text> : null}</View>
      <View style={styles.field}><Text style={styles.label}>¿Dónde se movió el dinero?</Text><Controller control={control} name="medio" render={({ field: { onChange, value } }) => <View style={styles.methodGrid}>{methods.map((method) => <Pressable key={method} onPress={() => onChange(method)} style={[styles.method, value === method && styles.methodActive]}><Ionicons color={value === method ? colors.primary : colors.textMuted} name={method === 'EFECTIVO' ? 'cash-outline' : method === 'YAPE' || method === 'PLIN' ? 'phone-portrait-outline' : 'card-outline'} size={16} /><Text style={[styles.methodText, value === method && styles.methodTextActive]}>{method.charAt(0) + method.slice(1).toLowerCase()}</Text></Pressable>)}</View>} /></View>
      <View style={styles.field}><Text style={styles.label}>Nota <Text style={styles.optional}>(opcional)</Text></Text><Controller control={control} name="nota" render={({ field: { onBlur, onChange, value } }) => <TextInput multiline onBlur={onBlur} onChangeText={onChange} placeholder={isWithdrawal ? 'Ej. Retiro de capital propio' : 'Ej. Dinero agregado a la cartera'} placeholderTextColor={colors.textMuted} style={styles.noteInput} value={value} />} />{errors.nota ? <Text style={styles.error}>{errors.nota.message}</Text> : null}</View>
    </View>
    <View style={styles.audit}><Ionicons color={colors.primary} name="shield-checkmark-outline" size={20} /><Text style={styles.auditText}>Después de guardarlo no se editará ni borrará. Si hubo un error, podrás crear un reverso con su motivo.</Text></View>
    <Pressable disabled={mutation.isPending} onPress={handleSubmit((values) => mutation.mutate(values))} style={({ pressed }) => [styles.submit, isWithdrawal && styles.submitDanger, (pressed || mutation.isPending) && styles.pressed]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={20} /><Text style={styles.submitText}>Confirmar movimiento</Text></>}</Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, topBar: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, scroll: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: 48, gap: spacing.xl, boxSizing: 'border-box' },
  intro: { flexDirection: 'row', borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1 }, introPositive: { backgroundColor: colors.successSoft, borderColor: '#CDEFE0' }, introDanger: { backgroundColor: colors.dangerSoft, borderColor: '#F8D3D8' }, introIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, iconPositive: { backgroundColor: '#FFFFFFA8' }, iconDanger: { backgroundColor: '#FFFFFFA8' }, introCopy: { flex: 1 }, introTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, introText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: fonts.regular, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.xl, ...shadows.card }, field: { gap: spacing.sm }, label: { color: colors.text, fontSize: 15, fontFamily: fonts.bold }, optional: { color: colors.textMuted, fontFamily: fonts.regular }, moneyInput: { height: 66, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: spacing.lg }, currency: { color: colors.primary, fontSize: 18, fontFamily: fonts.extraBold, marginRight: spacing.sm }, moneyText: { flex: 1, color: colors.text, fontSize: 28, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, method: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }, methodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, methodText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.semibold }, methodTextActive: { color: colors.primary }, noteInput: { minHeight: 92, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, fontSize: 15, fontFamily: fonts.regular, textAlignVertical: 'top' },
  audit: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.primarySoft, padding: spacing.lg, borderRadius: radii.lg }, auditText: { flex: 1, color: colors.primaryDark, fontSize: 13, lineHeight: 20, fontFamily: fonts.medium }, submit: { minHeight: 55, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, submitDanger: { backgroundColor: colors.danger }, submitText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.bold }, pressed: { opacity: 0.7 },
});
