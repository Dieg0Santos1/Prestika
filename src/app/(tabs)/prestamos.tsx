import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { LoanCard } from '@/components/loan-card';
import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { getLoansSummary } from '@/features/prestamos/api';
import { formatMoneyText } from '@/utils/money';

type Filter = 'ACTIVOS' | 'HISTORIAL' | 'TODOS';
type HistoryStage = 5 | 15 | 30;

export default function LoansScreen() {
  const [filter, setFilter] = useState<Filter>('ACTIVOS');
  const [historyStage, setHistoryStage] = useState<HistoryStage>(5);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const loansQuery = useQuery({ queryKey: ['prestamos'], queryFn: () => getLoansSummary() });
  const loans = loansQuery.data?.prestamos ?? [];
  const historicalLoans = loans.filter((loan) => loan.estado !== 'ACTIVO');
  const parsedFrom = parseDateInput(dateFrom, false);
  const parsedTo = parseDateInput(dateTo, true);
  const invalidRange = Boolean(parsedFrom && parsedTo && parsedFrom > parsedTo);
  const advancedActive = advancedOpen && Boolean(clientSearch.trim() || parsedFrom || parsedTo) && !invalidRange;
  const advancedLoans = historicalLoans.filter((loan) => {
    const nameMatches = !clientSearch.trim() || normalize(loan.cliente_nombre).includes(normalize(clientSearch));
    const timestamp = new Date(loan.fecha_prestamo).getTime();
    return nameMatches && (!parsedFrom || timestamp >= parsedFrom) && (!parsedTo || timestamp <= parsedTo);
  });
  const visibleLoans = filter === 'ACTIVOS' ? loans.filter((loan) => loan.estado === 'ACTIVO')
    : filter === 'TODOS' ? loans
      : advancedActive ? advancedLoans : historicalLoans.slice(0, historyStage);
  const historyShown = Math.min(historyStage, historicalLoans.length);
  const canExpandHistory = filter === 'HISTORIAL' && !advancedOpen && historyStage < 30 && historicalLoans.length > historyStage;
  const historyComplete = filter === 'HISTORIAL' && !advancedOpen && historicalLoans.length > 0 && !canExpandHistory;

  function selectFilter(value: Filter) {
    setFilter(value);
    if (value === 'HISTORIAL') setHistoryStage(5);
    setAdvancedOpen(false);
  }

  function expandHistory() {
    setHistoryStage((current) => current === 5 ? 15 : 30);
  }

  function hideHistory() {
    setHistoryStage(5);
    setAdvancedOpen(false);
    setClientSearch('');
    setDateFrom('');
    setDateTo('');
  }

  return <AppScreen title="Préstamos" subtitle={loansQuery.data ? `${loansQuery.data.activos} activos · ${loansQuery.data.cantidad} en total` : 'Consultando tu cartera'} right={<Pressable accessibilityLabel="Nuevo préstamo" onPress={() => router.push('/prestamo/nuevo')} style={styles.add}><Ionicons color="#FFFFFF" name="add" size={23} /></Pressable>}>
    {loansQuery.data ? <View style={styles.hero}><View style={styles.heroIcon}><Ionicons color={colors.primary} name="trending-up-outline" size={22} /></View><View style={styles.heroCopy}><Text style={styles.heroLabel}>Total pendiente por cobrar</Text><Text style={styles.heroValue}>{formatMoneyText(loansQuery.data.por_cobrar, true)}</Text></View><View style={styles.activeBadge}><Text style={styles.activeNumber}>{loansQuery.data.activos}</Text><Text style={styles.activeLabel}>ACTIVOS</Text></View></View> : null}
    <View style={styles.filters}>{([['ACTIVOS', 'Activos'], ['HISTORIAL', 'Historial'], ['TODOS', 'Todos']] as const).map(([value, label]) => <Pressable key={value} onPress={() => selectFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</View>
    {filter === 'HISTORIAL' ? <View style={styles.historyHeading}><View><Text style={styles.historyTitle}>{advancedActive ? 'Resultados de búsqueda' : 'Préstamos anteriores'}</Text><Text style={styles.historySubtitle}>{advancedActive ? `${advancedLoans.length} ${advancedLoans.length === 1 ? 'préstamo encontrado' : 'préstamos encontrados'}` : `Mostrando ${historyShown} de ${Math.min(historicalLoans.length, 30)} recientes`}</Text></View><View style={styles.historyLimit}><Text style={styles.historyLimitText}>{advancedActive ? advancedLoans.length : historyShown}</Text></View></View> : null}
    {filter === 'HISTORIAL' && advancedOpen ? <AdvancedSearch client={clientSearch} dateFrom={dateFrom} dateTo={dateTo} invalidRange={invalidRange} onChangeClient={setClientSearch} onChangeFrom={(value) => setDateFrom(maskDate(value))} onChangeTo={(value) => setDateTo(maskDate(value))} onClear={() => { setClientSearch(''); setDateFrom(''); setDateTo(''); }} /> : null}
    {loansQuery.isPending ? <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.stateText}>Cargando préstamos...</Text></View> : null}
    {loansQuery.isError ? <View style={styles.state}><Ionicons color={colors.danger} name="cloud-offline-outline" size={28} /><Text style={styles.stateTitle}>No pudimos cargar la cartera</Text><Text style={styles.stateText}>{loansQuery.error.message}</Text><Pressable onPress={() => loansQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : null}
    {loansQuery.isSuccess && visibleLoans.length ? <View style={styles.list}>{visibleLoans.map((loan) => <LoanCard key={loan.id} loan={loan} onPress={() => router.push({ pathname: '/prestamo/[id]', params: { id: loan.id } })} />)}</View> : null}
    {loansQuery.isSuccess && canExpandHistory ? <Pressable onPress={expandHistory} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}><View style={styles.moreIcon}><Ionicons color={colors.primary} name="layers-outline" size={19} /></View><View style={styles.moreCopy}><Text style={styles.moreTitle}>Ver más</Text><Text style={styles.moreText}>{historyStage === 5 ? 'Mostrar los últimos 15 préstamos' : 'Mostrar los últimos 30 préstamos'}</Text></View><Ionicons color={colors.primary} name="chevron-down" size={19} /></Pressable> : null}
    {loansQuery.isSuccess && historyComplete ? <View style={styles.historyActions}><Pressable onPress={hideHistory} style={({ pressed }) => [styles.hideButton, pressed && styles.pressed]}><Ionicons color={colors.textSecondary} name="chevron-up" size={17} /><Text style={styles.hideText}>Ocultar</Text></Pressable><Pressable onPress={() => setAdvancedOpen(true)} style={({ pressed }) => [styles.advancedButton, pressed && styles.pressed]}><Ionicons color={colors.primary} name="search-outline" size={17} /><Text style={styles.advancedText}>Búsqueda avanzada</Text></Pressable></View> : null}
    {loansQuery.isSuccess && filter === 'HISTORIAL' && advancedOpen ? <View style={styles.advancedActions}><Pressable onPress={hideHistory} style={styles.compactButton}><Ionicons color={colors.textSecondary} name="chevron-up" size={16} /><Text style={styles.compactText}>Ocultar</Text></Pressable><Pressable onPress={() => setAdvancedOpen(false)} style={styles.compactButton}><Ionicons color={colors.primary} name="close" size={16} /><Text style={[styles.compactText, { color: colors.primary }]}>Cerrar búsqueda</Text></Pressable></View> : null}
    {loansQuery.isSuccess && visibleLoans.length === 0 ? <View style={styles.state}><View style={styles.emptyIcon}><Ionicons color={colors.primary} name={advancedActive ? 'search-outline' : 'wallet-outline'} size={29} /></View><Text style={styles.stateTitle}>{loansQuery.data.cantidad === 0 ? 'Crea tu primer préstamo' : advancedActive ? 'No encontramos préstamos' : 'No hay préstamos en esta vista'}</Text><Text style={styles.stateText}>{loansQuery.data.cantidad === 0 ? 'El desembolso se descontará de Caja y las cuotas se generarán automáticamente.' : advancedActive ? 'Prueba con otro cliente o amplía el intervalo de fechas.' : 'Cambia el filtro para consultar el resto de tu historial.'}</Text>{loansQuery.data.cantidad === 0 ? <Pressable onPress={() => router.push('/prestamo/nuevo')} style={styles.emptyAction}><Ionicons color="#FFFFFF" name="add" size={18} /><Text style={styles.emptyActionText}>Nuevo préstamo</Text></Pressable> : null}</View> : null}
  </AppScreen>;
}

function AdvancedSearch({ client, dateFrom, dateTo, invalidRange, onChangeClient, onChangeFrom, onChangeTo, onClear }: { client: string; dateFrom: string; dateTo: string; invalidRange: boolean; onChangeClient: (value: string) => void; onChangeFrom: (value: string) => void; onChangeTo: (value: string) => void; onClear: () => void }) {
  const hasValues = Boolean(client || dateFrom || dateTo);
  return <View style={styles.searchCard}><View style={styles.searchHeader}><View style={styles.searchHeaderIcon}><Ionicons color={colors.primary} name="options-outline" size={19} /></View><View style={styles.searchHeaderCopy}><Text style={styles.searchTitle}>Búsqueda avanzada</Text><Text style={styles.searchSubtitle}>Consulta también préstamos anteriores a los últimos 30.</Text></View>{hasValues ? <Pressable accessibilityLabel="Limpiar búsqueda" onPress={onClear} style={styles.clearButton}><Ionicons color={colors.textMuted} name="refresh" size={17} /></Pressable> : null}</View><View style={styles.searchField}><Text style={styles.searchLabel}>Cliente</Text><View style={styles.searchInputBox}><Ionicons color={colors.textMuted} name="person-outline" size={18} /><TextInput autoCapitalize="words" onChangeText={onChangeClient} placeholder="Nombre o apellido" placeholderTextColor={colors.textMuted} style={styles.searchInput} value={client} /></View></View><View style={styles.dateRow}><DateField label="Desde" onChangeText={onChangeFrom} value={dateFrom} /><DateField label="Hasta" onChangeText={onChangeTo} value={dateTo} /></View>{invalidRange ? <View style={styles.rangeError}><Ionicons color={colors.danger} name="alert-circle-outline" size={15} /><Text style={styles.rangeErrorText}>La fecha inicial no puede ser posterior a la fecha final.</Text></View> : <Text style={styles.searchHint}>Puedes usar uno o varios filtros · formato DD/MM/AAAA</Text>}</View>;
}

function DateField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return <View style={styles.dateField}><Text style={styles.searchLabel}>{label}</Text><View style={styles.dateInputBox}><Ionicons color={colors.textMuted} name="calendar-outline" size={17} /><TextInput accessibilityLabel={`Fecha ${label.toLocaleLowerCase('es-PE')}`} keyboardType="number-pad" maxLength={10} onChangeText={onChangeText} placeholder="DD/MM/AAAA" placeholderTextColor={colors.textMuted} style={styles.dateInput} value={value} /></View></View>;
}

function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-PE').trim(); }
function maskDate(value: string) { const digits = value.replace(/\D/g, '').slice(0, 8); return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/'); }
function parseDateInput(value: string, endOfDay: boolean) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split('/').map(Number);
  const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

const styles = StyleSheet.create({
  add: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.card }, hero: { minHeight: 110, borderRadius: radii.xl, backgroundColor: colors.navy, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, overflow: 'hidden', ...shadows.card }, heroIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1 }, heroLabel: { color: '#FFFFFFA8', fontSize: 12, fontFamily: fonts.medium }, heroValue: { color: '#FFFFFF', fontSize: 25, fontFamily: fonts.extraBold, marginTop: 3, fontVariant: ['tabular-nums'] }, activeBadge: { alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: '#FFFFFF14' }, activeNumber: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.extraBold }, activeLabel: { color: '#FFFFFF99', fontSize: 10, fontFamily: fonts.bold, marginTop: 1 },
  filters: { flexDirection: 'row', gap: spacing.sm }, filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.round, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, filterActive: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.semibold }, filterTextActive: { color: '#FFFFFF' }, historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, historyTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold }, historySubtitle: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium, marginTop: 3 }, historyLimit: { minWidth: 38, height: 32, paddingHorizontal: 8, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, historyLimitText: { color: colors.primary, fontSize: 13, fontFamily: fonts.extraBold }, list: { gap: spacing.md }, moreButton: { minHeight: 72, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.card }, moreIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, moreCopy: { flex: 1 }, moreTitle: { color: colors.primary, fontSize: 14, fontFamily: fonts.extraBold }, moreText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.medium, marginTop: 3 }, historyActions: { flexDirection: 'row', gap: spacing.sm }, hideButton: { flex: 0.75, minHeight: 50, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, hideText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.bold }, advancedButton: { flex: 1.25, minHeight: 50, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#DCD7FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, advancedText: { color: colors.primary, fontSize: 13, fontFamily: fonts.extraBold }, pressed: { opacity: 0.7 }, searchCard: { borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E2DEFF', padding: spacing.lg, gap: spacing.lg, ...shadows.card }, searchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, searchHeaderIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, searchHeaderCopy: { flex: 1 }, searchTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold }, searchSubtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 16, fontFamily: fonts.regular, marginTop: 3 }, clearButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' }, searchField: { gap: 6 }, searchLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.bold }, searchInputBox: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, searchInput: { flex: 1, color: colors.text, fontSize: 14, fontFamily: fonts.medium }, dateRow: { flexDirection: 'row', gap: spacing.sm }, dateField: { flex: 1, gap: 6 }, dateInputBox: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 5 }, dateInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, fontFamily: fonts.semibold }, searchHint: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular }, rangeError: { flexDirection: 'row', alignItems: 'center', gap: 6 }, rangeErrorText: { flex: 1, color: colors.danger, fontSize: 11, fontFamily: fonts.medium }, advancedActions: { flexDirection: 'row', justifyContent: 'space-between' }, compactButton: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radii.round, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, compactText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.bold }, state: { minHeight: 300, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, emptyIcon: { width: 60, height: 60, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, stateTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold, textAlign: 'center' }, stateText: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, fontFamily: fonts.regular, textAlign: 'center', maxWidth: 360 }, retry: { padding: spacing.md }, retryText: { color: colors.primary, fontSize: 14, fontFamily: fonts.bold }, emptyAction: { marginTop: spacing.md, minHeight: 46, paddingHorizontal: spacing.xl, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, emptyActionText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bold },
});
