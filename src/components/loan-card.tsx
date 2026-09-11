import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import type { Loan } from '@/features/prestamos/api';
import { formatMoneyText, formatPercentageText } from '@/utils/money';

const stateColors: Record<Loan['estado'], { background: string; foreground: string; label: string }> = {
  ACTIVO: { background: colors.successSoft, foreground: colors.success, label: 'Activo' },
  PAGADO: { background: colors.primarySoft, foreground: colors.primary, label: 'Pagado' },
  RENOVADO: { background: colors.warningSoft, foreground: colors.warning, label: 'Renovado' },
  INCOBRABLE: { background: colors.dangerSoft, foreground: colors.danger, label: 'Incobrable' },
  ANULADO: { background: colors.surfaceSoft, foreground: colors.textMuted, label: 'Anulado' },
};

export function LoanCard({ loan, onPress }: { loan: Loan; onPress: () => void }) {
  const state = stateColors[loan.estado];
  const date = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(loan.fecha_prestamo));
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.top}><View style={styles.clientIcon}><Ionicons color={colors.primary} name="person-outline" size={18} /></View><View style={styles.copy}><Text numberOfLines={1} style={styles.name}>{loan.cliente_nombre}</Text><Text style={styles.meta}>{date} · {loan.numero_cuotas} cuotas</Text></View><View style={[styles.state, { backgroundColor: state.background }]}><Text style={[styles.stateText, { color: state.foreground }]}>{state.label}</Text></View></View>
    <View style={styles.rule} />
    <View style={styles.amounts}><View><Text style={styles.label}>Saldo pendiente</Text><Text style={styles.balance}>{formatMoneyText(loan.saldo_pendiente, true)}</Text></View><View style={styles.right}><Text style={styles.label}>Total a cobrar</Text><Text style={styles.total}>{formatMoneyText(loan.total_a_cobrar, true)}</Text></View></View>
    <View style={styles.footer}><View style={styles.interestPill}><Ionicons color={colors.primary} name="trending-up-outline" size={13} /><Text style={styles.interestText}>{formatPercentageText(loan.porcentaje_interes)} interés</Text></View><Ionicons color={colors.textMuted} name="chevron-forward" size={18} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, ...shadows.card }, pressed: { opacity: 0.76, transform: [{ scale: 0.995 }] }, top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, clientIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, minWidth: 0 }, name: { color: colors.text, fontSize: 17, fontFamily: fonts.bold }, meta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium, marginTop: 4 }, state: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.round }, stateText: { fontSize: 12, fontFamily: fonts.bold }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md }, amounts: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, label: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium }, balance: { color: colors.primary, fontSize: 19, fontFamily: fonts.extraBold, marginTop: 4, fontVariant: ['tabular-nums'] }, right: { alignItems: 'flex-end' }, total: { color: colors.text, fontSize: 16, fontFamily: fonts.bold, marginTop: 6, fontVariant: ['tabular-nums'] }, footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }, interestPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radii.round }, interestText: { color: colors.primary, fontSize: 11, fontFamily: fonts.bold },
});
