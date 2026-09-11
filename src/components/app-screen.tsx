import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, spacing } from '@/constants/design';
import { useWideLayout } from '@/hooks/use-wide-layout';

const desktopLinks = [
  { label: 'Inicio', path: '/', icon: 'home-outline' as const },
  { label: 'Clientes', path: '/clientes', icon: 'people-outline' as const },
  { label: 'Caja', path: '/caja', icon: 'cash-outline' as const },
  { label: 'Préstamos', path: '/prestamos', icon: 'wallet-outline' as const },
  { label: 'Actividad', path: '/actividad', icon: 'receipt-outline' as const },
] as const;

export function AppScreen({ children, title, subtitle, right, safeTop = true, desktopNav = true }: PropsWithChildren<{ title?: string; subtitle?: string; right?: ReactNode; safeTop?: boolean; desktopNav?: boolean }>) {
  const isWide = useWideLayout();
  const pathname = usePathname();
  return (
    <SafeAreaView edges={safeTop ? ['top'] : []} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {desktopNav && isWide ? (
            <View style={styles.desktopNav}>
              <View style={styles.brand}>
                <View style={styles.brandMark}><Ionicons color="#FFFFFF" name="wallet" size={18} /></View>
                <View><Text style={styles.brandName}>Prestika</Text><Text style={styles.brandCaption}>PRÉSTAMOS</Text></View>
              </View>
              <View style={styles.desktopLinks}>
                {desktopLinks.map((link) => {
                  const active = pathname === link.path;
                  return (
                    <Pressable key={link.path} onPress={() => router.push(link.path)} style={[styles.desktopLink, active && styles.desktopLinkActive]}>
                      <Ionicons color={active ? colors.primary : colors.textSecondary} name={link.icon} size={17} />
                      <Text style={[styles.desktopLinkText, active && styles.desktopLinkTextActive]}>{link.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.profileDot}><Ionicons color={colors.primary} name="person" size={17} /></View>
            </View>
          ) : null}
          {(title || right) && (
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {right}
            </View>
          )}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxxl },
  content: { maxWidth: maxContentWidth, alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.xl, width: '100%', boxSizing: 'border-box' },
  desktopNav: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 'auto' },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.text, fontSize: 16, fontFamily: fonts.extraBold, lineHeight: 22 },
  brandCaption: { color: colors.primary, fontSize: 10, fontFamily: fonts.extraBold, letterSpacing: 1.4, marginTop: 2 },
  desktopLinks: { flexDirection: 'row', gap: spacing.xs },
  desktopLink: { minHeight: 42, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  desktopLinkActive: { backgroundColor: colors.primarySoft },
  desktopLinkText: { color: colors.textSecondary, fontSize: 15, fontFamily: fonts.semibold },
  desktopLinkTextActive: { color: colors.primary },
  profileDot: { width: 40, height: 40, borderRadius: 14, marginLeft: spacing.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.extraBold, letterSpacing: -0.7 },
  subtitle: { color: colors.textSecondary, fontSize: 17, fontFamily: fonts.regular, marginTop: spacing.xs },
});
