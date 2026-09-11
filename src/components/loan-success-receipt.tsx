import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, shadows, spacing } from '@/constants/design';
import type { LoanFormValues } from '@/features/prestamos/schema';
import { formatMoneyText, formatPercentageText } from '@/utils/money';

type ReceiptPreview = {
  amount: string;
  interest: string;
  total: string;
  firstInstallment: string;
};

export type LoanReceipt = {
  loanId: string;
  clientName: string;
  values: LoanFormValues;
  preview: ReceiptPreview;
};

export function LoanSuccessReceipt({ receipt, onContinue }: { receipt: LoanReceipt | null; onContinue: () => void }) {
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const [paper] = useState(() => new Animated.Value(-520));
  const [check] = useState(() => new Animated.Value(0));
  const [actions] = useState(() => new Animated.Value(0));
  const [printing, setPrinting] = useState(true);

  useEffect(() => {
    if (!receipt) return;
    let cancelled = false;
    paper.setValue(-520);
    check.setValue(0);
    actions.setValue(0);

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        paper.setValue(0);
        check.setValue(1);
        actions.setValue(1);
        setPrinting(false);
        return;
      }

      Animated.sequence([
        Animated.timing(paper, { toValue: -380, duration: 260, useNativeDriver: true }),
        Animated.timing(paper, { toValue: -230, duration: 300, useNativeDriver: true }),
        Animated.timing(paper, { toValue: -90, duration: 260, useNativeDriver: true }),
        Animated.timing(paper, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => {
        if (!cancelled) setPrinting(false);
      });
      Animated.sequence([
        Animated.delay(760),
        Animated.spring(check, { toValue: 1, damping: 13, stiffness: 105, mass: 0.8, useNativeDriver: true }),
        Animated.timing(actions, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    });

    return () => {
      cancelled = true;
      paper.stopAnimation();
      check.stopAnimation();
      actions.stopAnimation();
    };
  }, [actions, check, paper, receipt]);

  if (!receipt) return null;

  const method = receipt.values.medioDesembolso.charAt(0) + receipt.values.medioDesembolso.slice(1).toLowerCase();
  const operationTime = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date());

  return <Modal animationType="fade" onRequestClose={printing ? undefined : onContinue} statusBarTranslucent transparent visible>
    <SafeAreaView style={styles.modalSafe}>
      <ScrollView alwaysBounceVertical={false} contentContainerStyle={[styles.backdrop, compact && styles.backdropCompact]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <Animated.View style={[styles.confirmation, { opacity: check, transform: [{ scale: check.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1] }) }, { rotate: check.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) }] }]}>
          <Ionicons color="#32B97A" name="star" size={72} />
          <View style={styles.confirmationCheck}><Ionicons color="#FFFFFF" name="checkmark" size={28} /></View>
          <View style={[styles.sparkle, styles.sparkleLeft]} /><View style={[styles.sparkle, styles.sparkleRight]} />
        </Animated.View>
        <Text style={styles.title}>{printing ? 'Registrando operación' : '¡Préstamo creado!'}</Text>
      </View>

      <View accessibilityLabel="Comprobante de préstamo creado" style={[styles.printerArea, compact && styles.printerAreaCompact]}>
        <View style={styles.printer}>
          <View style={styles.printerLight} />
          <Ionicons color="#FFFFFF" name="print-outline" size={24} />
          <View style={styles.slot} />
        </View>
        <View style={styles.paperWindow}>
          <Animated.View style={[styles.receipt, { transform: [{ translateY: paper }] }]}>
            <View style={styles.receiptBrand}><View style={styles.brandMark}><Text style={styles.brandLetter}>P</Text></View><View><Text style={styles.brand}>PRESTIKA</Text><Text style={styles.brandCaption}>COMPROBANTE DE PRÉSTAMO</Text></View></View>
            <View style={styles.dashed} />
            <View style={styles.receiptTop}><View><Text style={styles.receiptLabel}>CLIENTE</Text><Text numberOfLines={1} style={styles.client}>{receipt.clientName}</Text></View><Text style={styles.folio}>#{receipt.loanId.slice(0, 8).toUpperCase()}</Text></View>
            <Text style={styles.date}>{operationTime}</Text>
            <View style={styles.dashed} />
            <ReceiptRow label="Monto entregado" value={formatMoneyText(receipt.preview.amount, true)} />
            <ReceiptRow label={`Interés (${formatPercentageText(receipt.values.porcentajeInteres)})`} value={formatMoneyText(receipt.preview.interest, true)} />
            <ReceiptRow label={`${receipt.values.numeroCuotas} cuotas aprox.`} value={formatMoneyText(receipt.preview.firstInstallment, true)} />
            <ReceiptRow label="Medio de entrega" value={method} />
            <View style={styles.dashed} />
            <View style={styles.totalRow}><Text style={styles.totalLabel}>TOTAL A COBRAR</Text><Text style={styles.total}>{formatMoneyText(receipt.preview.total, true)}</Text></View>
            <View style={styles.receiptFooter}><Ionicons color={colors.success} name="shield-checkmark" size={15} /><Text style={styles.receiptFooterText}>Operación guardada y protegida</Text></View>
            <View style={styles.cutLeft} /><View style={styles.cutRight} />
          </Animated.View>
        </View>
      </View>

      <Animated.View pointerEvents={printing ? 'none' : 'auto'} style={[styles.actions, { opacity: actions, transform: [{ translateY: actions.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <Pressable accessibilityRole="button" onPress={onContinue} style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}><Text style={styles.continueText}>Ver detalle del préstamo</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={19} /></Pressable>
        <Text style={styles.helper}>Ahí encontrarás las cuotas y toda la información financiera.</Text>
      </Animated.View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  brandLetter: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.extraBold },
  modalSafe: { flex: 1, backgroundColor: '#F0F2F8' },
  backdrop: { flexGrow: 1, backgroundColor: '#F0F2F8', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  backdropCompact: { paddingTop: spacing.sm },
  header: { alignItems: 'center', justifyContent: 'center', minHeight: 124 },
  headerCompact: { minHeight: 114 },
  confirmation: { width: 80, height: 74, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  confirmationCheck: { position: 'absolute', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#72D8A9' },
  sparkleLeft: { left: 1, top: 15 },
  sparkleRight: { right: 1, bottom: 12 },
  title: { color: colors.text, fontSize: 21, fontFamily: fonts.extraBold, letterSpacing: -0.4, marginTop: 3, textAlign: 'center' },
  printerArea: { width: '100%', maxWidth: 430, alignItems: 'center' },
  printerAreaCompact: { marginTop: 0 },
  printer: { zIndex: 2, width: 220, height: 78, borderRadius: radii.lg, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  printerLight: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#65E5AE', right: 20, top: 17 },
  slot: { position: 'absolute', height: 7, left: 18, right: 18, bottom: -2, borderRadius: 4, backgroundColor: '#050F29' },
  paperWindow: { width: '100%', height: 500, overflow: 'hidden', alignItems: 'center' },
  receipt: { width: '100%', minHeight: 474, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, ...shadows.card },
  receiptBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.text, fontSize: 15, fontFamily: fonts.extraBold, letterSpacing: 0.6 },
  brandCaption: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.8, marginTop: 2 },
  dashed: { height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: spacing.lg },
  receiptTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  receiptLabel: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.8 },
  client: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold, marginTop: 3, maxWidth: 210 },
  folio: { color: colors.primary, fontSize: 11, fontFamily: fonts.bold, backgroundColor: colors.primarySoft, borderRadius: radii.round, paddingHorizontal: 8, paddingVertical: 5 },
  date: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.regular, marginTop: 4 },
  row: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.medium },
  rowValue: { color: colors.text, fontSize: 13, fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  totalLabel: { color: colors.text, fontSize: 12, fontFamily: fonts.extraBold },
  total: { color: colors.primary, fontSize: 20, fontFamily: fonts.extraBold, fontVariant: ['tabular-nums'] },
  receiptFooter: { marginTop: spacing.xl, minHeight: 42, borderRadius: radii.sm, backgroundColor: colors.successSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  receiptFooterText: { color: colors.success, fontSize: 11, fontFamily: fonts.bold },
  cutLeft: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#F0F2F8', left: -9, bottom: 70 },
  cutRight: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#F0F2F8', right: -9, bottom: 70 },
  actions: { width: '100%', maxWidth: 400, alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  continueButton: { width: '100%', minHeight: 54, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card },
  continueText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.bold },
  helper: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, textAlign: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
