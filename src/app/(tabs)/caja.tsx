import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CashMovementRow } from '@/components/cash-movement-row';
import { FinancialBalanceCard } from '@/components/financial-balance-card';
import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { getCashSummary } from '@/features/caja/api';
import { formatMoneyText } from '@/utils/money';

type MovementScope = 'RECENT' | 'WEEK' | 'MONTH';

export default function CashScreen() {
  const cashQuery = useQuery({ queryKey: ['caja'], queryFn: getCashSummary });
  const cash = cashQuery.data;
  const isEmpty = cash?.cantidad_movimientos === 0;
  const [movementView, setMovementView] = useState<{ monthKey: string; scope: MovementScope } | null>(null);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const movementScope = movementView?.monthKey === monthKey ? movementView.scope : 'RECENT';
  const monthName = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(now);
  const monthMovements = (cash?.movimientos ?? []).filter((movement) => {
    const date = new Date(movement.ocurrido_at);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const weekExpanded = monthMovements.filter((movement, index) => index < 5 || new Date(movement.ocurrido_at) >= weekStart);
  const displayedMovements = movementScope === 'RECENT' ? monthMovements.slice(0, 5) : movementScope === 'WEEK' ? weekExpanded : monthMovements;
  const nextScope: MovementScope | null = movementScope === 'RECENT' && monthMovements.length > 5 ? 'WEEK' : movementScope === 'WEEK' ? 'MONTH' : null;

  useFocusEffect(useCallback(() => {
    const reset = setTimeout(() => setMovementView(null), 0);
    return () => clearTimeout(reset);
  }, []));

  function setMovementScope(scope: MovementScope) {
    setMovementView({ monthKey, scope });
  }

  function openMovement(type: 'CAPITAL_INICIAL' | 'APORTE_CAPITAL' | 'RETIRO_CAPITAL') {
    router.push({ pathname: '/caja/movimiento', params: { tipo: type } });
  }

  return (
    <AppScreen title="Caja" subtitle="El dinero real disponible para prestar">
      {cashQuery.isPending ? <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.stateText}>Calculando tu caja...</Text></View> : null}
      {cashQuery.isError ? <View style={styles.state}><View style={styles.stateIcon}><Ionicons color={colors.danger} name="cloud-offline-outline" size={25} /></View><Text style={styles.stateTitle}>No pudimos consultar la caja</Text><Text style={styles.stateText}>{cashQuery.error.message}</Text><Pressable onPress={() => cashQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : null}

      {cash ? <>
        <FinancialBalanceCard amount={cash.saldo} detail="Reconstruido desde entradas, salidas y reversos" ready={!isEmpty} />

        <View style={styles.actions}>
          <QuickAction color={colors.success} hint="Dinero que entra" icon="add" label={isEmpty ? 'Definir capital' : 'Agregar capital'} onPress={() => openMovement(isEmpty ? 'CAPITAL_INICIAL' : 'APORTE_CAPITAL')} />
          <QuickAction color={colors.danger} disabled={cash.saldo === '0.00'} hint="Dinero que sale" icon="arrow-up" label="Retirar capital" onPress={() => openMovement('RETIRO_CAPITAL')} />
        </View>

        <View style={styles.metrics}>
          <Metric color={colors.primary} icon="enter-outline" label="Capital aportado" value={formatMoneyText(cash.capital_aportado)} />
          <Metric color={colors.success} icon="cash-outline" label="Cobros recibidos" value={formatMoneyText(cash.cobros_recibidos)} />
          <Metric color={colors.danger} icon="exit-outline" label="Capital retirado" value={formatMoneyText(cash.capital_retirado)} />
        </View>

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}><View><Text style={styles.historyTitle}>Movimientos de {monthName}</Text><Text style={styles.historySubtitle}>{movementScope === 'RECENT' ? 'Los 5 más recientes' : movementScope === 'WEEK' ? 'Actividad de los últimos 7 días' : `Todo el registro de ${monthName}`}</Text></View><View style={styles.countPill}><Text style={styles.countText}>{displayedMovements.length}<Text style={styles.countTotal}>/{monthMovements.length}</Text></Text></View></View>
          {displayedMovements.length ? displayedMovements.map((movement) => <CashMovementRow key={movement.id} movement={movement} onPress={['CAPITAL_INICIAL', 'APORTE_CAPITAL', 'RETIRO_CAPITAL'].includes(movement.tipo) && !movement.esta_revertido ? () => router.push({ pathname: '/caja/revertir', params: { id: movement.id } }) : undefined} />) : <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons color={colors.primary} name="layers-outline" size={25} /></View><Text style={styles.emptyTitle}>{isEmpty ? 'Configura tu capital inicial' : `Sin movimientos en ${monthName}`}</Text><Text style={styles.emptyText}>{isEmpty ? 'Este será el primer movimiento de tu caja y la base para saber cuánto puedes prestar.' : 'Los nuevos movimientos del mes aparecerán aquí automáticamente.'}</Text></View>}
          {nextScope ? <Pressable onPress={() => setMovementScope(nextScope)} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}><View style={styles.moreIcon}><Ionicons color={colors.primary} name={nextScope === 'WEEK' ? 'calendar-outline' : 'calendar-number-outline'} size={19} /></View><View style={styles.moreCopy}><Text style={styles.moreTitle}>Ver más</Text><Text style={styles.moreText}>{nextScope === 'WEEK' ? `Completar los últimos 7 días · ${weekExpanded.length} movimientos` : `Mostrar todo ${monthName} · ${monthMovements.length} movimientos`}</Text></View><Ionicons color={colors.primary} name="chevron-down" size={18} /></Pressable> : movementScope === 'MONTH' && monthMovements.length > 5 ? <Pressable onPress={() => setMovementScope('RECENT')} style={styles.lessButton}><Ionicons color={colors.textMuted} name="chevron-up" size={15} /><Text style={styles.lessText}>Mostrar solo los 5 recientes</Text></Pressable> : null}
        </View>
      </> : null}
    </AppScreen>
  );
}

function QuickAction({ color, disabled = false, icon, label, hint, onPress }: { color: string; disabled?: boolean; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; hint: string; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}><View style={[styles.actionAccent, { backgroundColor: color }]} /><View style={[styles.actionGlow, { backgroundColor: `${color}0C` }]} /><View style={styles.actionTop}><View style={[styles.actionTag, { backgroundColor: `${color}10` }]}><Text style={[styles.actionTagText, { color }]}>{icon === 'add' ? 'ENTRADA' : 'SALIDA'}</Text></View><View style={[styles.actionIcon, { backgroundColor: `${color}14` }]}><Ionicons color={color} name={icon} size={23} /></View></View><View style={styles.actionCopy}><Text numberOfLines={2} style={styles.actionLabel}>{label}</Text><Text style={styles.actionHint}>{hint}</Text></View></Pressable>;
}

function Metric({ color, icon, label, value }: { color: string; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return <View style={styles.metric}><View style={[styles.metricAccent, { backgroundColor: color }]} /><View style={styles.metricTop}><Text style={styles.metricLabel}>{label}</Text><View style={[styles.metricIcon, { backgroundColor: `${color}12` }]}><Ionicons color={color} name={icon} size={19} /></View></View><Text style={styles.metricValue}>{value}</Text><View style={styles.metricFooter}><View style={[styles.metricDot, { backgroundColor: color }]} /><Text style={styles.metricHint}>Acumulado histórico</Text></View></View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md }, action: { flex: 1, minWidth: 0, minHeight: 138, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#ECEEF6', ...shadows.card }, actionAccent: { position: 'absolute', top: 0, left: spacing.lg, right: spacing.lg, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }, actionGlow: { position: 'absolute', width: 100, height: 100, borderRadius: 50, right: -42, top: -42 }, actionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, actionTag: { minHeight: 24, paddingHorizontal: 8, borderRadius: radii.round, alignItems: 'center', justifyContent: 'center' }, actionTagText: { fontSize: 10, fontFamily: fonts.extraBold, letterSpacing: 0.9 }, actionIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, actionCopy: { marginTop: 'auto', paddingTop: spacing.md }, actionLabel: { color: colors.text, fontSize: 15, lineHeight: 20, fontFamily: fonts.extraBold }, actionHint: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, marginTop: 4 }, disabled: { opacity: 0.42 }, pressed: { opacity: 0.72 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, metric: { flexGrow: 1, flexBasis: 145, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, minHeight: 142, overflow: 'hidden', borderWidth: 1, borderColor: '#ECEEF6', ...shadows.card }, metricAccent: { position: 'absolute', left: 0, top: spacing.lg, bottom: spacing.lg, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 }, metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, metricIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, metricLabel: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: fonts.semibold }, metricValue: { color: colors.text, fontSize: 19, lineHeight: 26, fontFamily: fonts.extraBold, marginTop: spacing.md, fontVariant: ['tabular-nums'] }, metricFooter: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }, metricDot: { width: 5, height: 5, borderRadius: 3 }, metricHint: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.medium },
  historyCard: { backgroundColor: colors.surface, borderRadius: radii.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, ...shadows.card }, historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md }, historyTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold, textTransform: 'capitalize' }, historySubtitle: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, marginTop: 3 }, countPill: { minWidth: 42, height: 32, paddingHorizontal: 8, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, countText: { color: colors.primary, fontSize: 13, fontFamily: fonts.extraBold }, countTotal: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bold }, moreButton: { minHeight: 72, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, moreIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, moreCopy: { flex: 1 }, moreTitle: { color: colors.primary, fontSize: 14, fontFamily: fonts.extraBold }, moreText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, marginTop: 3 }, lessButton: { minHeight: 52, marginHorizontal: -spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, lessText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bold },
  empty: { minHeight: 235, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, emptyTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold }, emptyText: { color: colors.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 20, maxWidth: 330, marginTop: spacing.sm, fontFamily: fonts.regular },
  state: { minHeight: 320, backgroundColor: colors.surface, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm, ...shadows.card }, stateIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }, stateTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold }, stateText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, textAlign: 'center' }, retry: { padding: spacing.md }, retryText: { color: colors.primary, fontSize: 15, fontFamily: fonts.bold },
});
