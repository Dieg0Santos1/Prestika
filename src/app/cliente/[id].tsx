import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/app-screen';
import { LoanCard } from '@/components/loan-card';
import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { getClientById, setClientStatus } from '@/features/clientes/api';
import { getLoansSummary } from '@/features/prestamos/api';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const clientQuery = useQuery({ queryKey: ['clientes', id], queryFn: () => getClientById(id), enabled: Boolean(id) });
  const loansQuery = useQuery({ queryKey: ['prestamos', 'cliente', id], queryFn: () => getLoansSummary(id), enabled: Boolean(id) });
  const statusMutation = useMutation({
    mutationFn: (estado: 'ACTIVO' | 'INACTIVO') => setClientStatus(id, estado),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clientes'] }),
        queryClient.invalidateQueries({ queryKey: ['clientes', id] }),
      ]);
    },
    onError: (error) => Alert.alert('No se pudo actualizar', error.message),
  });

  const client = clientQuery.data;
  const initials = client ? `${client.nombres.at(0) ?? ''}${client.apellidos?.at(0) ?? ''}`.toUpperCase() : '';
  const activeLoans = loansQuery.data?.prestamos.filter((loan) => loan.estado === 'ACTIVO') ?? [];
  const historicalLoansCount = (loansQuery.data?.prestamos.length ?? 0) - activeLoans.length;

  function confirmStatusChange() {
    if (!client) return;
    const nextStatus = client.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    Alert.alert(
      nextStatus === 'INACTIVO' ? 'Inactivar cliente' : 'Reactivar cliente',
      nextStatus === 'INACTIVO' ? 'El historial se conservará y podrás reactivarlo después.' : 'El cliente volverá a estar disponible para nuevas operaciones.',
      [{ text: 'Cancelar', style: 'cancel' }, { text: nextStatus === 'INACTIVO' ? 'Inactivar' : 'Reactivar', style: nextStatus === 'INACTIVO' ? 'destructive' : 'default', onPress: () => statusMutation.mutate(nextStatus) }],
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topBar}><Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="chevron-back" size={23} /></Pressable><Text style={styles.topTitle}>Detalle del cliente</Text><Pressable accessibilityLabel="Editar cliente" onPress={() => router.push({ pathname: '/cliente/editar', params: { id } })} style={styles.topButton}><Ionicons color={colors.text} name="create-outline" size={21} /></Pressable></View>
      <AppScreen desktopNav={false} safeTop={false}>
        {clientQuery.isPending ? <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Consultando Supabase...</Text></View> : null}
        {clientQuery.isError ? <View style={styles.loading}><Ionicons color={colors.danger} name="alert-circle-outline" size={30} /><Text style={styles.errorTitle}>No se pudo cargar el cliente</Text><Text style={styles.muted}>{clientQuery.error.message}</Text></View> : null}
        {client ? <>
          <View style={styles.profile}><View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View><View style={styles.profileCopy}><View style={styles.nameRow}><Text style={styles.name}>{client.nombres} {client.apellidos}</Text><View style={[styles.state, client.estado === 'ACTIVO' ? styles.activeState : styles.inactiveState]}><Text style={[styles.stateText, { color: client.estado === 'ACTIVO' ? colors.success : colors.textMuted }]}>{client.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</Text></View></View><View style={styles.phoneRow}><Ionicons color={colors.textSecondary} name="call-outline" size={14} /><Text style={styles.phone}>{client.celular || 'Sin celular registrado'}</Text></View></View></View>

          <View style={styles.infoCard}><Text style={styles.sectionTitle}>Información</Text><InfoRow icon="card-outline" label="Medio preferido" value={client.metodo_pago_preferido ? client.metodo_pago_preferido.charAt(0) + client.metodo_pago_preferido.slice(1).toLocaleLowerCase() : 'Sin especificar'} /><InfoRow icon="phone-portrait-outline" label="Número Yape/Plin" value={client.numero_yape_plin || 'Sin especificar'} /><InfoRow icon="document-text-outline" label="Observaciones" value={client.observaciones || 'Sin observaciones'} noBorder /></View>

          {loansQuery.isPending ? <View style={styles.loanLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Consultando préstamos...</Text></View> : null}
          {loansQuery.isError ? <View style={styles.loanLoading}><Ionicons color={colors.danger} name="alert-circle-outline" size={24} /><Text style={styles.errorTitle}>No se pudo cargar la cartera</Text><Text style={styles.muted}>{loansQuery.error.message}</Text></View> : null}
          {loansQuery.data ? <View style={styles.loanSection}><View style={styles.loanHeader}><View><Text style={styles.sectionTitle}>Préstamo actual</Text><Text style={styles.loanSubtitle}>{activeLoans.length ? 'Seguimiento de la operación activa' : 'Sin deuda activa'}</Text></View><View style={styles.loanActions}><Pressable accessibilityLabel={`Abrir historial de ${historicalLoansCount} préstamos`} onPress={() => router.push({ pathname: '/cliente/historial', params: { id } })} style={styles.archiveAction}><Ionicons color={colors.primary} name="albums-outline" size={18} />{historicalLoansCount > 0 ? <View style={styles.archiveBadge}><Text style={styles.archiveBadgeText}>{historicalLoansCount > 99 ? '99+' : historicalLoansCount}</Text></View> : null}</Pressable>{client.estado === 'ACTIVO' && activeLoans.length === 0 ? <Pressable onPress={() => router.push({ pathname: '/prestamo/nuevo', params: { clienteId: id } })} style={styles.smallAction}><Ionicons color={colors.primary} name="add" size={16} /><Text style={styles.smallActionText}>Nuevo</Text></Pressable> : null}</View></View>{activeLoans.map((loan) => <LoanCard key={loan.id} loan={loan} onPress={() => router.push({ pathname: '/prestamo/[id]', params: { id: loan.id } })} />)}{activeLoans.length === 0 && loansQuery.data.cantidad > 0 ? <View style={styles.noActiveLoan}><View style={styles.noActiveIcon}><Ionicons color={colors.success} name="checkmark-circle-outline" size={24} /></View><View style={styles.noActiveCopy}><Text style={styles.noActiveTitle}>Sin préstamo pendiente</Text><Text style={styles.noActiveText}>Las operaciones anteriores están guardadas en el historial.</Text></View><Pressable accessibilityLabel="Abrir historial" onPress={() => router.push({ pathname: '/cliente/historial', params: { id } })} style={styles.noActiveArrow}><Ionicons color={colors.primary} name="arrow-forward" size={17} /></Pressable></View> : null}{loansQuery.data.cantidad === 0 ? <View style={styles.emptyLoan}><View style={styles.emptyIcon}><Ionicons color={colors.primary} name="wallet-outline" size={26} /></View><Text style={styles.emptyTitle}>Sin préstamos registrados</Text><Text style={styles.muted}>Crea el primer préstamo; el desembolso se descontará automáticamente de Caja.</Text>{client.estado === 'ACTIVO' ? <Pressable onPress={() => router.push({ pathname: '/prestamo/nuevo', params: { clienteId: id } })} style={styles.primaryButton}><Ionicons color="#FFFFFF" name="add" size={19} /><Text style={styles.primaryText}>Crear préstamo</Text></Pressable> : null}</View> : null}</View> : null}

          <Pressable disabled={statusMutation.isPending} onPress={confirmStatusChange} style={styles.statusButton}>{statusMutation.isPending ? <ActivityIndicator color={colors.textSecondary} /> : <Text style={[styles.statusButtonText, client.estado === 'ACTIVO' && { color: colors.danger }]}>{client.estado === 'ACTIVO' ? 'Inactivar cliente' : 'Reactivar cliente'}</Text>}</Pressable>
        </> : null}
      </AppScreen>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, noBorder = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; noBorder?: boolean }) {
  return <View style={[styles.infoRow, noBorder && styles.noBorder]}><View style={styles.infoIcon}><Ionicons color={colors.primary} name={icon} size={17} /></View><View style={styles.infoCopy}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, topBar: { width: '100%', maxWidth: 1080, alignSelf: 'center', height: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold },
  loading: { minHeight: 320, backgroundColor: colors.surface, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md }, muted: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, fontFamily: fonts.regular, textAlign: 'center', maxWidth: 360 }, errorTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, avatar: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, avatarText: { color: '#FFFFFF', fontSize: 18, fontFamily: fonts.extraBold }, profileCopy: { flex: 1, gap: spacing.sm }, nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }, name: { color: colors.text, fontSize: 20, fontFamily: fonts.extraBold }, state: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.round }, activeState: { backgroundColor: colors.successSoft }, inactiveState: { backgroundColor: colors.surfaceSoft }, stateText: { fontSize: 13, fontFamily: fonts.bold }, phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, phone: { color: colors.textSecondary, fontSize: 15, fontFamily: fonts.regular },
  infoCard: { backgroundColor: colors.surface, borderRadius: radii.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, ...shadows.card }, sectionTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold, marginBottom: spacing.sm }, infoRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, noBorder: { borderBottomWidth: 0 }, infoIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, infoCopy: { flex: 1 }, infoLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium }, infoValue: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold, marginTop: 3 },
  emptyLoan: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.sm, ...shadows.card }, emptyIcon: { width: 56, height: 56, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, emptyTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, primaryButton: { minHeight: 48, paddingHorizontal: spacing.xl, marginTop: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, primaryText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.bold },
  loanLoading: { minHeight: 120, backgroundColor: colors.surface, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, ...shadows.card }, loanSection: { gap: spacing.md }, loanHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, loanSubtitle: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.medium, marginTop: 3 }, loanActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, archiveAction: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadows.card }, archiveBadge: { position: 'absolute', right: -5, top: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }, archiveBadgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: fonts.extraBold }, smallAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, borderRadius: 14 }, smallActionText: { color: colors.primary, fontSize: 13, fontFamily: fonts.bold },
  noActiveLoan: { minHeight: 82, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card }, noActiveIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }, noActiveCopy: { flex: 1 }, noActiveTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.bold }, noActiveText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, marginTop: 3 }, noActiveArrow: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  statusButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, statusButtonText: { color: colors.success, fontSize: 15, fontFamily: fonts.bold },
});
