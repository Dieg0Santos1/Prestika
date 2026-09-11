import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import type { Client } from '@/features/clientes/api';

function initials(client: Client) {
  return `${client.nombres.at(0) ?? ''}${client.apellidos?.at(0) ?? ''}`.toUpperCase();
}

export function ClientRow({ client, onPress }: { client: Client; onPress: () => void }) {
  const active = client.estado === 'ACTIVO';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(client)}</Text></View>
      <View style={styles.copy}>
        <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{client.nombres} {client.apellidos}</Text><View style={[styles.state, active ? styles.stateActive : styles.stateInactive]}><Text style={[styles.stateText, active ? styles.stateActiveText : styles.stateInactiveText]}>{active ? 'Activo' : 'Inactivo'}</Text></View></View>
        <Text style={styles.meta}>{client.celular || 'Sin celular'}{client.metodo_pago_preferido ? ` · ${client.metodo_pago_preferido}` : ''}</Text>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, ...shadows.card },
  pressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.extraBold },
  copy: { flex: 1, gap: 6, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, fontSize: 18, fontFamily: fonts.bold, flexShrink: 1 },
  meta: { color: colors.textSecondary, fontSize: 14, lineHeight: 19, fontFamily: fonts.regular },
  state: { borderRadius: radii.round, paddingHorizontal: 8, paddingVertical: 4 }, stateActive: { backgroundColor: colors.successSoft }, stateInactive: { backgroundColor: colors.surfaceSoft },
  stateText: { fontSize: 13, fontFamily: fonts.bold }, stateActiveText: { color: colors.success }, stateInactiveText: { color: colors.textMuted },
});
