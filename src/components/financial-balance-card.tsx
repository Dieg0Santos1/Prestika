import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { fonts, shadows, spacing } from '@/constants/design';
import { formatMoneyText } from '@/utils/money';

export function FinancialBalanceCard({ amount, ready, detail }: { amount: string; ready: boolean; detail: string }) {
  const { width } = useWindowDimensions();
  const height = Math.min(276, Math.max(232, Math.min(width - spacing.xxxl, 1048) / 1.7));

  return <LinearGradient colors={['#071B48', '#142E70', '#553AF0']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={[styles.card, { height }]}>
    <View style={styles.glow} /><View style={styles.orbit} />
    <View style={styles.top}><View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandLetter}>P</Text></View><View><Text style={styles.brandName}>PRESTIKA</Text><Text style={styles.brandSub}>CAJA PERSONAL</Text></View></View><Ionicons color="#FFFFFFB8" name="wifi-outline" size={23} style={styles.contactless} /></View>
    <View style={styles.balanceRow}>
      <View style={styles.balanceCopy}><Text style={styles.label}>DISPONIBLE PARA PRESTAR</Text><Text style={styles.amount}>{formatMoneyText(amount, true)}</Text></View>
      <View style={styles.chip}><View style={styles.chipLine} /><View style={styles.chipLine} /></View>
    </View>
    <View style={styles.bottom}><Text numberOfLines={2} style={styles.bottomText}>{detail}</Text><View style={styles.status}><View style={[styles.statusDot, ready && styles.readyDot]} /><Text style={styles.statusText}>{ready ? 'Al día' : 'Pendiente'}</Text></View></View>
  </LinearGradient>;
}

const styles = StyleSheet.create({
  brandLetter: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.extraBold },
  card: { borderRadius: 28, padding: spacing.xxl, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF26', ...shadows.card },
  glow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#745DFF3D', right: -64, bottom: -100 },
  orbit: { position: 'absolute', width: 255, height: 255, borderRadius: 128, borderWidth: 1.5, borderColor: '#FFFFFF14', right: -68, top: -106 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFF1F', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF1F' },
  brandName: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.extraBold, letterSpacing: 1.4 },
  brandSub: { color: '#FFFFFF76', fontSize: 10, fontFamily: fonts.bold, letterSpacing: 1, marginTop: 2 },
  contactless: { transform: [{ rotate: '90deg' }] },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg, marginTop: spacing.xl },
  balanceCopy: { flex: 1, minWidth: 0 },
  chip: { width: 38, height: 27, borderRadius: 8, backgroundColor: '#E9D6A3', marginBottom: 8, paddingVertical: 6, overflow: 'hidden', justifyContent: 'space-around' },
  chipLine: { height: 1, backgroundColor: '#A9874C66' },
  label: { color: '#FFFFFFA8', fontSize: 11, fontFamily: fonts.extraBold, letterSpacing: 1.15 },
  amount: { color: '#FFFFFF', fontSize: 35, lineHeight: 43, fontFamily: fonts.extraBold, letterSpacing: -1.1, marginTop: 2, fontVariant: ['tabular-nums'] },
  bottom: { marginTop: 'auto', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: '#FFFFFF1C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  bottomText: { flex: 1, color: '#FFFFFFD1', fontSize: 11, lineHeight: 16, fontFamily: fonts.medium },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF14', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EA8C22' },
  readyDot: { backgroundColor: '#68E6B2' },
  statusText: { color: '#FFFFFFE0', fontSize: 11, fontFamily: fonts.bold },
});
