import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { getCashSummary, reverseCashMovement } from '@/features/caja/api';
import { reversalSchema, type ReversalFormValues } from '@/features/caja/schema';
import { formatMoneyText } from '@/utils/money';

export default function ReverseCashMovementScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const requestId = useRef(Crypto.randomUUID());
  const cashQuery = useQuery({ queryKey: ['caja'], queryFn: getCashSummary });
  const movement = cashQuery.data?.movimientos.find((item) => item.id === id);
  const { control, handleSubmit, formState: { errors } } = useForm<ReversalFormValues>({ resolver: zodResolver(reversalSchema), defaultValues: { motivo: '' } });
  const mutation = useMutation({ mutationFn: (values: ReversalFormValues) => reverseCashMovement(id, values.motivo, requestId.current), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['caja'] }), queryClient.invalidateQueries({ queryKey: ['actividad'] })]); router.back(); }, onError: (error) => Alert.alert('No se pudo revertir', error.message) });

  return <SafeAreaView edges={['top']} style={styles.safe}><View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Revertir movimiento</Text><View style={styles.topButton} /></View><View style={styles.content}>
    <View style={styles.warning}><View style={styles.warningIcon}><Ionicons color={colors.danger} name="return-up-back-outline" size={25} /></View><Text style={styles.warningTitle}>El historial se conservará</Text><Text style={styles.warningText}>Se creará un movimiento opuesto enlazado al original. Ningún registro será eliminado ni modificado.</Text></View>
    {movement ? <View style={styles.summary}><Text style={styles.summaryLabel}>Movimiento original</Text><View style={styles.summaryRow}><View><Text style={styles.summaryType}>{movement.tipo.replaceAll('_', ' ')}</Text><Text style={styles.summaryMeta}>{movement.medio}</Text></View><Text style={[styles.summaryAmount, movement.direccion === 1 ? styles.positive : styles.negative]}>{movement.direccion === 1 ? '+' : '−'} {formatMoneyText(movement.monto, true)}</Text></View></View> : null}
    <View style={styles.form}><Text style={styles.label}>Motivo del reverso *</Text><Controller control={control} name="motivo" render={({ field: { onBlur, onChange, value } }) => <TextInput autoFocus multiline onBlur={onBlur} onChangeText={onChange} placeholder="Ej. Registré el monto equivocado" placeholderTextColor={colors.textMuted} style={[styles.input, errors.motivo && styles.inputError]} value={value} />} />{errors.motivo ? <Text style={styles.error}>{errors.motivo.message}</Text> : null}</View>
    <Pressable disabled={!movement || mutation.isPending} onPress={handleSubmit((values) => mutation.mutate(values))} style={({ pressed }) => [styles.submit, (!movement || mutation.isPending) && styles.disabled, pressed && styles.pressed]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="return-up-back" size={19} /><Text style={styles.submitText}>Confirmar reverso</Text></>}</Pressable>
    <Pressable onPress={() => router.back()} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, topBar: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, gap: spacing.xl, boxSizing: 'border-box' },
  warning: { alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: radii.xl, padding: spacing.xxl, borderWidth: 1, borderColor: '#F7D5DA' }, warningIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FFFFFFA8', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, warningTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold }, warningText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: fonts.regular, textAlign: 'center', maxWidth: 390, marginTop: spacing.sm },
  summary: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, ...shadows.card }, summaryLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8 }, summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }, summaryType: { color: colors.text, fontSize: 15, fontFamily: fonts.bold }, summaryMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium, marginTop: 3 }, summaryAmount: { fontSize: 17, fontFamily: fonts.extraBold }, positive: { color: colors.success }, negative: { color: colors.danger },
  form: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm, ...shadows.card }, label: { color: colors.text, fontSize: 15, fontFamily: fonts.bold }, input: { minHeight: 110, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.background, color: colors.text, padding: spacing.md, fontSize: 15, fontFamily: fonts.regular, textAlignVertical: 'top' }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium },
  submit: { minHeight: 54, borderRadius: radii.md, backgroundColor: colors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, submitText: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.bold }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72 }, cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.textSecondary, fontSize: 15, fontFamily: fonts.bold },
});
