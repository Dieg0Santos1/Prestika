import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/design';

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.row}><Text style={styles.title}>{title}</Text>{action}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold, letterSpacing: -0.25 },
});
