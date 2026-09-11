import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { ClientRow } from '@/components/client-row';
import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import { listClients } from '@/features/clientes/api';

type Filter = 'TODOS' | 'ACTIVO' | 'INACTIVO';

export default function ClientsScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('TODOS');
  const clientsQuery = useQuery({ queryKey: ['clientes'], queryFn: listClients });

  const visibleClients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (clientsQuery.data ?? []).filter((client) => {
      const fullName = `${client.nombres} ${client.apellidos ?? ''}`.toLocaleLowerCase();
      const matchesSearch = !term || fullName.includes(term) || client.celular?.includes(term);
      const matchesFilter = filter === 'TODOS' || client.estado === filter;
      return matchesSearch && matchesFilter;
    });
  }, [clientsQuery.data, filter, search]);

  return (
    <AppScreen
      title="Clientes"
      subtitle={clientsQuery.data ? `${clientsQuery.data.length} personas registradas` : 'Cargando tus clientes...'}
      right={<Pressable accessibilityLabel="Nuevo cliente" onPress={() => router.push('/cliente/nuevo')} style={styles.addButton}><Ionicons color="#FFFFFF" name="person-add" size={19} /></Pressable>}>
      <View style={styles.searchBox}><Ionicons color={colors.textMuted} name="search" size={19} /><TextInput accessibilityLabel="Buscar cliente" onChangeText={setSearch} placeholder="Buscar por nombre o celular..." placeholderTextColor={colors.textMuted} style={styles.input} value={search} /></View>
      <View style={styles.chips}>
        {([['TODOS', 'Todos'], ['ACTIVO', 'Activos'], ['INACTIVO', 'Inactivos']] as const).map(([value, label]) => (
          <Pressable key={value} onPress={() => setFilter(value)} style={[styles.chip, filter === value && styles.chipActive]}><Text style={[styles.chipText, filter === value && styles.chipActiveText]}>{label}</Text></Pressable>
        ))}
      </View>

      {clientsQuery.isPending ? <View style={styles.stateBox}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.stateText}>Consultando Supabase...</Text></View> : null}
      {clientsQuery.isError ? <View style={styles.stateBox}><View style={styles.stateIcon}><Ionicons color={colors.danger} name="cloud-offline-outline" size={25} /></View><Text style={styles.stateTitle}>No pudimos cargar los clientes</Text><Text style={styles.stateText}>{clientsQuery.error.message}</Text><Pressable onPress={() => clientsQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : null}
      {clientsQuery.isSuccess && visibleClients.length > 0 ? <View style={styles.list}>{visibleClients.map((client) => <ClientRow client={client} key={client.id} onPress={() => router.push(`/cliente/${client.id}`)} />)}</View> : null}
      {clientsQuery.isSuccess && visibleClients.length === 0 ? <View style={styles.stateBox}><View style={styles.stateIcon}><Ionicons color={colors.primary} name="people-outline" size={26} /></View><Text style={styles.stateTitle}>{clientsQuery.data.length === 0 ? 'Aún no tienes clientes' : 'No encontramos coincidencias'}</Text><Text style={styles.stateText}>{clientsQuery.data.length === 0 ? 'Crea tu primer cliente para comenzar a registrar préstamos.' : 'Prueba con otro nombre, celular o filtro.'}</Text>{clientsQuery.data.length === 0 ? <Pressable onPress={() => router.push('/cliente/nuevo')} style={styles.emptyAction}><Ionicons color="#FFFFFF" name="add" size={18} /><Text style={styles.emptyActionText}>Crear primer cliente</Text></Pressable> : null}</View> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 52, backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border }, input: { flex: 1, color: colors.text, fontSize: 17, fontFamily: fonts.regular },
  chips: { flexDirection: 'row', gap: spacing.sm }, chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.round, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.textSecondary, fontSize: 15, fontFamily: fonts.semibold }, chipActiveText: { color: '#FFFFFF' },
  list: { gap: spacing.md }, stateBox: { minHeight: 270, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card }, stateIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, stateTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold, textAlign: 'center' }, stateText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, fontFamily: fonts.regular, textAlign: 'center', maxWidth: 340 },
  retry: { paddingHorizontal: 18, paddingVertical: 10, marginTop: spacing.sm }, retryText: { color: colors.primary, fontSize: 15, fontFamily: fonts.bold }, emptyAction: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.md }, emptyActionText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.bold },
});
