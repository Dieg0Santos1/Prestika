import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { getLoansSummary, reversePayment } from '@/features/prestamos/api';
import { formatMoneyText } from '@/utils/money';

export default function ReversePaymentScreen() {
  const { prestamoId = '', pagoId = '' } = useLocalSearchParams<{ prestamoId?: string; pagoId?: string }>();
  const queryClient = useQueryClient();
  const requestId = useRef(Crypto.randomUUID());
  const [reason, setReason] = useState('');
  const loansQuery = useQuery({ queryKey: ['prestamos'], queryFn: () => getLoansSummary() });
  const loan = loansQuery.data?.prestamos.find((item) => item.id === prestamoId);
  const payment = loan?.pagos.find((item) => item.id === pagoId && item.tipo === 'PAGO' && !item.esta_revertido);
  const validReason = reason.trim().length >= 3 && reason.trim().length <= 500;
  const mutation = useMutation({
    mutationFn: () => reversePayment(pagoId, reason, requestId.current),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prestamos'] }),
        queryClient.invalidateQueries({ queryKey: ['caja'] }),
        queryClient.invalidateQueries({ queryKey: ['actividad'] }),
      ]);
      router.replace({ pathname: '/prestamo/[id]', params: { id: prestamoId } });
    },
  });

  return <SafeAreaView edges={['top']} style={styles.safe}><View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Revertir pago</Text><View style={styles.topButton} /></View><View style={styles.content}>
    {loansQuery.isPending ? <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View> : null}
    {loansQuery.isSuccess && !payment ? <View style={styles.loading}><Ionicons color={colors.warning} name="alert-circle-outline" size={30} /><Text style={styles.warningTitle}>Este pago ya no puede revertirse</Text><Pressable onPress={() => router.back()} style={styles.backAction}><Text style={styles.backActionText}>Volver</Text></Pressable></View> : null}
    {payment ? <>
      <View style={styles.warning}><View style={styles.warningIcon}><Ionicons color={colors.danger} name="return-up-back-outline" size={27} /></View><Text style={styles.warningTitle}>El historial se conservará</Text><Text style={styles.warningText}>Se registrará un reverso enlazado al pago. La cuota, el saldo del préstamo y Caja volverán a su situación anterior.</Text></View>
      <View style={styles.summary}><Text style={styles.caption}>PAGO ORIGINAL</Text><Text style={styles.client}>{loan?.cliente_nombre}</Text><Text style={styles.amount}>{formatMoneyText(payment.monto, true)}</Text><View style={styles.summaryRule} /><View style={styles.summaryFooter}><Text style={styles.summaryLabel}>{payment.cuotas.length > 1 ? 'Pago total' : `Cuota ${payment.cuotas[0] ?? ''}`}</Text><Text style={styles.summaryLabel}>{payment.medio.charAt(0) + payment.medio.slice(1).toLowerCase()}</Text></View></View>
      <View style={styles.field}><Text style={styles.label}>Motivo del reverso *</Text><TextInput autoFocus multiline onChangeText={setReason} placeholder="Ej. Pago registrado por error" placeholderTextColor={colors.textMuted} style={styles.input} value={reason} /><Text style={[styles.counter, reason.length > 500 && styles.counterError]}>{reason.length}/500</Text></View>
      {mutation.isError ? <View style={styles.errorBox}><Ionicons color={colors.danger} name="alert-circle-outline" size={18} /><Text style={styles.errorText}>{mutation.error.message}</Text></View> : null}
      <Pressable disabled={!validReason || mutation.isPending} onPress={() => mutation.mutate()} style={({ pressed }) => [styles.submit, (!validReason || mutation.isPending || pressed) && styles.disabled]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="return-up-back-outline" size={19} /><Text style={styles.submitText}>Confirmar reverso</Text></>}</Pressable>
      <Text style={styles.caution}>La reversión retirará {formatMoneyText(payment.monto, true)} de Caja. Se bloqueará si el saldo disponible no es suficiente.</Text>
    </> : null}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, content: { width: '100%', maxWidth: Math.min(maxContentWidth, 520), alignSelf: 'center', padding: spacing.lg, gap: spacing.xl }, loading: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  warning: { alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: radii.xl, padding: spacing.xl }, warningIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, warningTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold, textAlign: 'center' }, warningText: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, fontFamily: fonts.regular, textAlign: 'center', marginTop: spacing.sm },
  summary: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, ...shadows.card }, caption: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.extraBold, letterSpacing: 1 }, client: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginTop: spacing.sm }, amount: { color: colors.danger, fontSize: 30, fontFamily: fonts.extraBold, marginTop: 4, fontVariant: ['tabular-nums'] }, summaryRule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md }, summaryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, summaryLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.semibold },
  field: { gap: spacing.sm }, label: { color: colors.text, fontSize: 14, fontFamily: fonts.bold }, input: { minHeight: 100, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, color: colors.text, fontSize: 14, fontFamily: fonts.regular, textAlignVertical: 'top' }, counter: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium, textAlign: 'right' }, counterError: { color: colors.danger }, errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radii.md }, errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 18, fontFamily: fonts.medium }, submit: { minHeight: 54, borderRadius: radii.md, backgroundColor: colors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, submitText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bold }, disabled: { opacity: 0.45 }, caution: { color: colors.textMuted, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, textAlign: 'center' }, backAction: { padding: spacing.md }, backActionText: { color: colors.primary, fontSize: 13, fontFamily: fonts.bold },
});
