import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { FinancialBalanceCard } from '@/components/financial-balance-card';
import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { getActivity, type ActivityEvent } from '@/features/actividad/api';
import { getCashSummary } from '@/features/caja/api';
import { listClients } from '@/features/clientes/api';
import { getLoansSummary } from '@/features/prestamos/api';
import { useAuth } from '@/providers/auth-provider';
import { formatMoneyText } from '@/utils/money';

export default function HomeScreen() {
  const { signOut } = useAuth();
  const clientsQuery = useQuery({ queryKey: ['clientes'], queryFn: listClients });
  const cashQuery = useQuery({ queryKey: ['caja'], queryFn: getCashSummary });
  const loansQuery = useQuery({ queryKey: ['prestamos'], queryFn: () => getLoansSummary() });
  const activityQuery = useQuery({ queryKey: ['actividad'], queryFn: getActivity });
  const clientsCount = clientsQuery.data?.length ?? 0;
  const cash = cashQuery.data;
  const activeLoans = loansQuery.data?.prestamos.filter((loan) => loan.estado === 'ACTIVO') ?? [];
  const setupComplete = clientsCount > 0 && Boolean(cash?.cantidad_movimientos) && Boolean(loansQuery.data?.cantidad);

  function openPayment() {
    if (activeLoans.length === 1) {
      router.push({ pathname: '/pago/nuevo', params: { prestamoId: activeLoans[0].id } });
      return;
    }
    router.push('/prestamos');
  }

  function confirmSignOut() {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <AppScreen>
      <View style={styles.welcomeRow}><View><Text style={styles.eyebrow}>RESUMEN GENERAL</Text><Text style={styles.greeting}>Hola, bienvenido</Text></View><Pressable accessibilityLabel="Cerrar sesión" onPress={confirmSignOut} style={styles.iconButton}><Ionicons color={colors.text} name="log-out-outline" size={21} /></Pressable></View>

      <FinancialBalanceCard amount={cash?.saldo ?? '0.00'} detail={cash?.cantidad_movimientos ? 'Saldo derivado de tu ledger' : 'Configura tu capital inicial'} ready={Boolean(cash?.cantidad_movimientos)} />

      <View style={styles.quickActions}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/prestamo/nuevo')} style={({ pressed }) => [styles.quickAction, styles.quickActionPrimary, pressed && styles.quickActionPressed]}>
          <View style={styles.quickPrimaryIcon}><Ionicons color="#FFFFFF" name="add" size={22} /></View><View style={styles.quickCopy}><Text style={styles.quickPrimaryText}>Nuevo préstamo</Text></View>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!activeLoans.length} onPress={openPayment} style={({ pressed }) => [styles.quickAction, styles.quickActionSecondary, !activeLoans.length && styles.quickActionDisabled, pressed && styles.quickActionPressed]}>
          <View style={styles.quickSecondaryIcon}><Ionicons color={colors.success} name="cash-outline" size={20} /></View><View style={styles.quickCopy}><Text style={styles.quickSecondaryText}>Registrar pago</Text></View>
        </Pressable>
      </View>

      <MetricsCarousel clientsCount={clientsCount} consolidatedProfit={loansQuery.data?.ganancia_consolidada ?? '0.00'} activeLoans={loansQuery.data?.activos ?? 0} receivable={loansQuery.data?.por_cobrar ?? '0.00'} />

      {!setupComplete ? <View style={styles.onboarding}><Text style={styles.sectionTitle}>Preparar tu cartera</Text><SetupStep complete={clientsCount > 0} description={clientsCount > 0 ? `${clientsCount} cliente${clientsCount === 1 ? '' : 's'} registrado${clientsCount === 1 ? '' : 's'}` : 'Agrega las personas a quienes prestas'} label="Registrar clientes" onPress={() => router.push('/clientes')} step="1" /><SetupStep complete={Boolean(cash?.cantidad_movimientos)} description={cash?.cantidad_movimientos ? `${formatMoneyText(cash.saldo, true)} disponibles` : 'Indica cuánto dinero tienes para prestar'} label="Configurar caja inicial" onPress={() => router.push('/caja')} step="2" /><SetupStep complete={Boolean(loansQuery.data?.cantidad)} description={loansQuery.data?.cantidad ? `${loansQuery.data.cantidad} préstamo${loansQuery.data.cantidad === 1 ? '' : 's'} registrado${loansQuery.data.cantidad === 1 ? '' : 's'}` : 'Define monto, interés y número de cuotas'} label="Crear el primer préstamo" onPress={() => router.push(loansQuery.data?.cantidad ? '/prestamos' : '/prestamo/nuevo')} step="3" /></View> : null}

      {activityQuery.data?.eventos.length ? <View style={styles.activityCard}><View style={styles.activityHeader}><View><Text style={styles.sectionTitle}>Actividad reciente</Text><Text style={styles.activitySubtitle}>Préstamos, cobros, renovaciones y Caja</Text></View><Pressable onPress={() => router.push('/actividad')}><Text style={styles.seeAll}>Ver todo</Text></Pressable></View>{activityQuery.data.eventos.slice(0, 3).map((event) => <RecentActivityRow event={event} key={`${event.tipo}-${event.id}`} />)}</View> : <View style={styles.emptyActivity}><View style={styles.emptyIcon}><Ionicons color={colors.primary} name="receipt-outline" size={25} /></View><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>Aún no hay movimientos</Text><Text style={styles.emptyText}>Los pagos, desembolsos y renovaciones reales aparecerán aquí.</Text></View></View>}
    </AppScreen>
  );
}

function MetricsCarousel({ clientsCount, activeLoans, receivable, consolidatedProfit }: { clientsCount: number; activeLoans: number; receivable: string; consolidatedProfit: string }) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = Math.min(Math.max(width - 72, 276), 360);
  const step = cardWidth + spacing.md;
  const metrics = [
    { icon: 'people-outline' as const, eyebrow: 'TU RED', label: 'Clientes', value: String(clientsCount), detail: `${clientsCount} persona${clientsCount === 1 ? '' : 's'} registrada${clientsCount === 1 ? '' : 's'}`, footer: 'Cartera total', color: colors.primary, soft: colors.primarySoft },
    { icon: 'trending-up-outline' as const, eyebrow: 'CARTERA ACTIVA', label: 'Por cobrar', value: formatMoneyText(receivable), detail: activeLoans ? `${activeLoans} préstamo${activeLoans === 1 ? '' : 's'} activo${activeLoans === 1 ? '' : 's'}` : 'Sin préstamos activos', footer: 'Saldo vivo', color: colors.cyan, soft: '#E7F8FA' },
    { icon: 'sparkles-outline' as const, eyebrow: 'RESULTADO REAL', label: 'Ganancia consolidada', value: formatMoneyText(consolidatedProfit), detail: 'Intereses ganados.', footer: 'Ganancia confirmada', color: colors.warning, soft: colors.warningSoft },
  ];
  function trackPosition(event: NativeSyntheticEvent<NativeScrollEvent>) { setActiveIndex(Math.max(0, Math.min(metrics.length - 1, Math.round(event.nativeEvent.contentOffset.x / step)))); }

  return <View style={styles.carouselSection}><View style={styles.carouselHeader}><View><Text style={styles.carouselTitle}>Tu cartera en números</Text><Text style={styles.carouselSubtitle}>Desliza para explorar cada indicador</Text></View><View style={styles.carouselCount}><Text style={styles.carouselCountText}>{activeIndex + 1}</Text><Text style={styles.carouselCountDivider}>/</Text><Text style={styles.carouselCountTotal}>{metrics.length}</Text></View></View><ScrollView accessibilityLabel="Indicadores de cartera" contentContainerStyle={styles.carouselContent} decelerationRate="fast" horizontal onMomentumScrollEnd={trackPosition} showsHorizontalScrollIndicator={false} snapToAlignment="start" snapToInterval={step}>{metrics.map((metric) => <View key={metric.label} style={[styles.metricCard, { width: cardWidth }]}><View style={[styles.metricGlow, { backgroundColor: metric.soft }]} /><View style={styles.metricTop}><View style={[styles.metricIcon, { backgroundColor: metric.soft }]}><Ionicons color={metric.color} name={metric.icon} size={21} /></View><View style={[styles.metricTag, { backgroundColor: metric.soft }]}><Text style={[styles.metricTagText, { color: metric.color }]}>{metric.eyebrow}</Text></View></View><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricAmount}>{metric.value}</Text><View style={styles.metricBottom}><Text style={styles.metricDetail}>{metric.detail}</Text><View style={styles.metricFooter}><View style={[styles.metricFooterDot, { backgroundColor: metric.color }]} /><Text style={styles.metricFooterText}>{metric.footer}</Text></View></View></View>)}</ScrollView><View style={styles.pagination}>{metrics.map((metric, index) => <View key={metric.label} style={[styles.pageDot, index === activeIndex && styles.pageDotActive]} />)}</View></View>;
}

function SetupStep({ step, label, description, complete = false, onPress }: { step: string; label: string; description: string; complete?: boolean; onPress?: () => void }) { return <Pressable disabled={!onPress} onPress={onPress} style={styles.setupRow}><View style={[styles.stepCircle, complete && styles.stepComplete]}>{complete ? <Ionicons color="#FFFFFF" name="checkmark" size={17} /> : <Text style={styles.stepNumber}>{step}</Text>}</View><View style={styles.setupCopy}><Text style={styles.setupLabel}>{label}</Text><Text style={styles.setupDescription}>{description}</Text></View>{onPress ? <Ionicons color={colors.textMuted} name="chevron-forward" size={19} /> : <View style={styles.soonPill}><Text style={styles.soonText}>Próximo</Text></View>}</Pressable>; }

function RecentActivityRow({ event }: { event: ActivityEvent }) {
  const payment = event.categoria === 'COBRO'; const renewal = event.categoria === 'RENOVACION'; const closure = event.categoria === 'CIERRE'; const reversed = event.tipo === 'PAGO_REVERTIDO' || event.tipo === 'REVERSO_CAJA' || event.esta_revertido;
  const color = event.tipo === 'PRESTAMO_INCOBRABLE' ? colors.danger : event.tipo === 'PRESTAMO_ANULADO' ? colors.textMuted : reversed ? colors.warning : payment ? colors.success : renewal ? colors.primary : event.direccion === -1 ? colors.cyan : colors.primary;
  const icon: React.ComponentProps<typeof Ionicons>['name'] = event.tipo === 'PRESTAMO_INCOBRABLE' ? 'alert-circle-outline' : event.tipo === 'PRESTAMO_ANULADO' ? 'close-circle-outline' : reversed ? 'return-up-back-outline' : payment ? 'cash-outline' : renewal ? 'refresh-outline' : event.tipo === 'PRESTAMO_CREADO' ? 'wallet-outline' : 'business-outline';
  const title = event.tipo === 'PRESTAMO_INCOBRABLE' ? 'Préstamo incobrable' : event.tipo === 'PRESTAMO_ANULADO' ? 'Préstamo anulado' : renewal ? 'Préstamo renovado' : event.tipo === 'PRESTAMO_CREADO' ? 'Préstamo creado' : event.tipo === 'PAGO_RECIBIDO' ? 'Pago recibido' : event.tipo === 'PAGO_REVERTIDO' ? 'Pago revertido' : event.tipo === 'CAPITAL_INICIAL' ? 'Capital inicial' : event.tipo === 'APORTE_CAPITAL' ? 'Aporte de capital' : event.tipo === 'RETIRO_CAPITAL' ? 'Retiro de capital' : 'Reverso de Caja';
  const amount = renewal || event.tipo === 'PRESTAMO_CREADO' ? event.monto_base ?? event.monto : event.monto;
  const sign = renewal || closure || event.tipo === 'PRESTAMO_CREADO' ? '' : event.direccion === 1 ? '+ ' : '− ';
  const date = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(event.ocurrido_at));
  return <Pressable disabled={!event.prestamo_id} onPress={() => event.prestamo_id && router.push({ pathname: '/prestamo/[id]', params: { id: event.prestamo_id } })} style={styles.recentRow}><View style={[styles.recentIcon, { backgroundColor: `${color}14` }]}><Ionicons color={color} name={icon} size={17} /></View><View style={styles.recentCopy}><Text numberOfLines={1} style={styles.recentTitle}>{title}</Text><Text numberOfLines={1} style={styles.recentMeta}>{date}{event.cliente_nombre ? ` · ${event.cliente_nombre}` : ''}</Text></View><Text style={[styles.recentAmount, { color }]}>{sign}{formatMoneyText(amount, true)}</Text>{event.prestamo_id ? <Ionicons color={colors.textMuted} name="chevron-forward" size={15} /> : null}</Pressable>;
}

const styles = StyleSheet.create({
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md }, eyebrow: { color: colors.primary, fontSize: 14, fontFamily: fonts.extraBold, letterSpacing: 1.2 }, greeting: { color: colors.text, fontSize: 27, fontFamily: fonts.extraBold, letterSpacing: -0.8, marginTop: 3 }, iconButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  quickActions: { flexDirection: 'row', gap: spacing.md },
  quickAction: { flex: 1, minWidth: 0, minHeight: 68, borderRadius: radii.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...shadows.card },
  quickActionPrimary: { backgroundColor: colors.primary },
  quickActionSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#DDF2E8' },
  quickActionDisabled: { opacity: 0.5 },
  quickActionPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  quickPrimaryIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#FFFFFF20', alignItems: 'center', justifyContent: 'center' },
  quickSecondaryIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center' },
  quickPrimaryText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontFamily: fonts.extraBold },
  quickSecondaryText: { color: colors.text, fontSize: 13, lineHeight: 18, fontFamily: fonts.extraBold },
  carouselSection: { marginHorizontal: -spacing.lg }, carouselHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md }, carouselTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold }, carouselSubtitle: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, marginTop: 3 }, carouselCount: { minWidth: 44, height: 32, borderRadius: 11, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, ...shadows.card }, carouselCountText: { color: colors.primary, fontSize: 13, fontFamily: fonts.extraBold }, carouselCountDivider: { color: colors.border, fontSize: 13, fontFamily: fonts.bold }, carouselCountTotal: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bold }, carouselContent: { paddingHorizontal: spacing.lg, paddingVertical: 4, gap: spacing.md }, metricCard: { minHeight: 164, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#ECEEF6', ...shadows.card }, metricGlow: { position: 'absolute', width: 132, height: 132, borderRadius: 66, right: -48, top: -66, opacity: 0.72 }, metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, metricIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, metricTag: { minHeight: 24, borderRadius: radii.round, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' }, metricTagText: { fontSize: 10, fontFamily: fonts.extraBold, letterSpacing: 0.8 }, metricLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.semibold, marginTop: spacing.sm }, metricAmount: { color: colors.text, fontSize: 25, lineHeight: 31, fontFamily: fonts.extraBold, letterSpacing: -0.7, marginTop: 1, fontVariant: ['tabular-nums'] }, metricBottom: { marginTop: 'auto', paddingTop: spacing.xs, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm }, metricDetail: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 16, fontFamily: fonts.regular }, metricFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 }, metricFooterDot: { width: 5, height: 5, borderRadius: 3 }, metricFooterText: { color: colors.textSecondary, fontSize: 10, fontFamily: fonts.bold }, pagination: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D8DAE5' }, pageDotActive: { width: 20, backgroundColor: colors.primary },
  onboarding: { backgroundColor: colors.surface, borderRadius: radii.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, ...shadows.card }, sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold, marginBottom: spacing.sm }, setupRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, stepCircle: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, stepComplete: { backgroundColor: colors.success }, stepNumber: { color: colors.primary, fontSize: 15, fontFamily: fonts.extraBold }, setupCopy: { flex: 1 }, setupLabel: { color: colors.text, fontSize: 16, fontFamily: fonts.bold }, setupDescription: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.regular, marginTop: 4 }, soonPill: { backgroundColor: colors.warningSoft, borderRadius: radii.round, paddingHorizontal: 9, paddingVertical: 5 }, soonText: { color: colors.warning, fontSize: 12, fontFamily: fonts.bold },
  emptyActivity: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.card }, emptyIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, emptyCopy: { flex: 1 }, emptyTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.bold }, emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, marginTop: 4 },
  activityCard: { backgroundColor: colors.surface, borderRadius: radii.xl, paddingHorizontal: spacing.lg, ...shadows.card }, activityHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, activitySubtitle: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, marginTop: 3 }, seeAll: { color: colors.primary, fontSize: 13, fontFamily: fonts.bold },
  recentRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, recentIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, recentCopy: { flex: 1, minWidth: 0 }, recentTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.bold }, recentMeta: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium, marginTop: 4 }, recentAmount: { fontSize: 13, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] },
});
