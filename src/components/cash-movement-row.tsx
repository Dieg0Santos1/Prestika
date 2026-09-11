import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/constants/design';
import type { CashMovement } from '@/features/caja/api';
import { formatMoneyText } from '@/utils/money';

const labels: Record<CashMovement['tipo'], string> = {
  CAPITAL_INICIAL: 'Capital inicial',
  APORTE_CAPITAL: 'Aporte de capital',
  RETIRO_CAPITAL: 'Retiro de capital',
  DESEMBOLSO_PRESTAMO: 'Préstamo entregado',
  COBRO_PRESTAMO: 'Cobro recibido',
  REVERSO: 'Reverso',
};

const icons: Record<CashMovement['tipo'], React.ComponentProps<typeof Ionicons>['name']> = {
  CAPITAL_INICIAL: 'flag-outline',
  APORTE_CAPITAL: 'arrow-down-outline',
  RETIRO_CAPITAL: 'arrow-up-outline',
  DESEMBOLSO_PRESTAMO: 'wallet-outline',
  COBRO_PRESTAMO: 'cash-outline',
  REVERSO: 'return-up-back-outline',
};

export function CashMovementRow({ movement, onPress }: { movement: CashMovement; onPress?: () => void }) {
  const positive = movement.direccion === 1;
  const muted = movement.esta_revertido;
  const date = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(movement.ocurrido_at));

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.icon, positive ? styles.iconPositive : styles.iconNegative]}>
        <Ionicons color={positive ? colors.success : colors.danger} name={icons[movement.tipo]} size={18} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleLine}><Text numberOfLines={1} style={[styles.title, muted && styles.muted]}>{labels[movement.tipo]}</Text>{muted ? <View style={styles.revertedBadge}><Text style={styles.revertedText}>Revertido</Text></View> : null}</View>
        <Text style={styles.meta}>{date} · {movement.medio.charAt(0) + movement.medio.slice(1).toLowerCase()}</Text>
        {movement.nota ? <Text numberOfLines={1} style={styles.note}>{movement.nota}</Text> : null}
      </View>
      <View style={styles.amountBox}>
        <Text style={[styles.amount, positive ? styles.positive : styles.negative, muted && styles.muted]}>{positive ? '+' : '−'} {formatMoneyText(movement.monto)}</Text>
        {onPress && !muted && movement.tipo !== 'REVERSO' ? <Text style={styles.action}>Ver opciones</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, pressed: { opacity: 0.7 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, iconPositive: { backgroundColor: colors.successSoft }, iconNegative: { backgroundColor: colors.dangerSoft },
  copy: { flex: 1, minWidth: 0 }, titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 }, title: { color: colors.text, fontSize: 15, fontFamily: fonts.bold, flexShrink: 1 }, meta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium, marginTop: 4 }, note: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.regular, marginTop: 3 },
  revertedBadge: { backgroundColor: colors.surfaceSoft, borderRadius: radii.round, paddingHorizontal: 6, paddingVertical: 3 }, revertedText: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold }, amountBox: { alignItems: 'flex-end' }, amount: { fontSize: 15, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] }, positive: { color: colors.success }, negative: { color: colors.danger }, muted: { opacity: 0.45 }, action: { color: colors.primary, fontSize: 11, fontFamily: fonts.semibold, marginTop: 5 },
});

