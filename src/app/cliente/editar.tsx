import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { getClientById, updateClient, type Client } from '@/features/clientes/api';
import { clientFormSchema, type ClientFormValues } from '@/features/clientes/schema';

const methods = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'] as const;

function formValues(client: Client): ClientFormValues {
  return {
    nombres: client.nombres,
    apellidos: client.apellidos ?? '',
    celular: client.celular ?? '',
    metodoPago: (client.metodo_pago_preferido ?? '') as ClientFormValues['metodoPago'],
    numeroYapePlin: client.numero_yape_plin ?? '',
    observaciones: client.observaciones ?? '',
  };
}

export default function EditClientScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const [saved, setSaved] = useState(false);
  const clientQuery = useQuery({ queryKey: ['clientes', id], queryFn: () => getClientById(id), enabled: Boolean(id) });
  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { nombres: '', apellidos: '', celular: '', metodoPago: '', numeroYapePlin: '', observaciones: '' },
  });
  const selectedMethod = useWatch({ control, name: 'metodoPago' });

  useEffect(() => {
    if (clientQuery.data && !initialized.current) { reset(formValues(clientQuery.data)); initialized.current = true; }
  }, [clientQuery.data, reset]);

  function close() {
    if (!isDirty || saved) { router.back(); return; }
    Alert.alert('¿Descartar cambios?', 'Los datos que modificaste no se guardarán.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isDirty || saved) return false;
      close(); return true;
    });
    return () => subscription.remove();
  });

  const mutation = useMutation({
    mutationFn: (values: ClientFormValues) => updateClient(id, values),
    onSuccess: async (client) => {
      reset(formValues(client)); setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clientes'] }),
        queryClient.invalidateQueries({ queryKey: ['prestamos'] }),
        queryClient.invalidateQueries({ queryKey: ['actividad'] }),
      ]);
    },
    onError: (error) => Alert.alert('No se pudieron guardar los cambios', error.message),
  });

  if (clientQuery.isPending) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.centerText}>Preparando los datos…</Text></SafeAreaView>;
  if (clientQuery.isError || !clientQuery.data) return <SafeAreaView style={styles.center}><View style={styles.errorIcon}><Ionicons color={colors.danger} name="alert-circle-outline" size={30} /></View><Text style={styles.centerTitle}>No pudimos abrir este cliente</Text><Text style={styles.centerText}>{clientQuery.error?.message ?? 'El cliente ya no está disponible.'}</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Volver</Text></Pressable></SafeAreaView>;

  const client = clientQuery.data;
  const initials = `${client.nombres.at(0) ?? ''}${client.apellidos?.at(0) ?? ''}`.toUpperCase();
  return <SafeAreaView edges={['top']} style={styles.safe}>
    <SavedModal clientName={`${client.nombres} ${client.apellidos ?? ''}`.trim()} onContinue={() => router.back()} visible={saved} />
    <View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={close} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Editar cliente</Text><View style={styles.topButton} /></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View><View style={styles.profileCopy}><Text style={styles.profileLabel}>EDITANDO PERFIL</Text><Text style={styles.profileName}>{client.nombres} {client.apellidos}</Text><Text style={styles.profileHint}>Los préstamos y movimientos no se modificarán.</Text></View><View style={styles.secure}><Ionicons color={colors.success} name="shield-checkmark" size={17} /></View></View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><View style={styles.sectionIcon}><Ionicons color={colors.primary} name="person-outline" size={18} /></View><View><Text style={styles.sectionTitle}>Información personal</Text><Text style={styles.sectionSubtitle}>El nombre es el único dato obligatorio</Text></View></View>
        <FormField control={control} error={errors.nombres?.message} label="Nombres *" name="nombres" placeholder="Ej. Rudy" />
        <FormField control={control} error={errors.apellidos?.message} label="Apellidos" name="apellidos" placeholder="Ej. Ramírez" />
        <FormField control={control} error={errors.celular?.message} keyboardType="phone-pad" label="Celular" name="celular" placeholder="987 654 321" />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><View style={styles.sectionIcon}><Ionicons color={colors.primary} name="card-outline" size={18} /></View><View><Text style={styles.sectionTitle}>Cobros y contacto</Text><Text style={styles.sectionSubtitle}>Información de referencia para tus pagos</Text></View></View>
        <View style={styles.fieldGroup}><Text style={styles.label}>Medio preferido</Text><Controller control={control} name="metodoPago" render={({ field: { onChange, value } }) => <View style={styles.methodGrid}>{methods.map((method) => { const active = value === method; return <Pressable key={method} onPress={() => onChange(active ? '' : method)} style={[styles.methodChip, active && styles.methodChipActive]}><Ionicons color={active ? colors.primary : colors.textMuted} name={method === 'EFECTIVO' ? 'cash-outline' : method === 'YAPE' || method === 'PLIN' ? 'phone-portrait-outline' : 'card-outline'} size={15} /><Text style={[styles.methodText, active && styles.methodTextActive]}>{titleCase(method)}</Text></Pressable>; })}</View>} /></View>
        {(selectedMethod === 'YAPE' || selectedMethod === 'PLIN') ? <FormField control={control} error={errors.numeroYapePlin?.message} keyboardType="phone-pad" label={`Número de ${titleCase(selectedMethod)}`} name="numeroYapePlin" placeholder="Número asociado" /> : null}
        <FormField control={control} error={errors.observaciones?.message} label="Observaciones" multiline name="observaciones" placeholder="Información adicional del cliente…" />
      </View>

      <View style={styles.audit}><Ionicons color={colors.primary} name="time-outline" size={19} /><View style={styles.auditCopy}><Text style={styles.auditTitle}>Historial protegido</Text><Text style={styles.auditText}>Esta edición actualiza solamente el perfil. Los préstamos, pagos, renovaciones y saldos permanecen intactos.</Text></View></View>
      <Pressable disabled={!isDirty || mutation.isPending} onPress={handleSubmit((values) => mutation.mutate(values))} style={({ pressed }) => [styles.saveButton, (!isDirty || mutation.isPending) && styles.disabled, pressed && styles.pressed]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={20} /><Text style={styles.saveText}>{isDirty ? 'Guardar cambios' : 'Sin cambios pendientes'}</Text></>}</Pressable>
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView>;
}

type FieldName = 'nombres' | 'apellidos' | 'celular' | 'numeroYapePlin' | 'observaciones';
function FormField({ control, error, label, name, placeholder, keyboardType = 'default', multiline = false }: { control: ReturnType<typeof useForm<ClientFormValues>>['control']; error?: string; label: string; name: FieldName; placeholder: string; keyboardType?: 'default' | 'phone-pad'; multiline?: boolean }) {
  return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><Controller control={control} name={name} render={({ field: { onBlur, onChange, value } }) => <TextInput autoCapitalize={keyboardType === 'default' ? 'sentences' : 'none'} keyboardType={keyboardType} maxLength={name === 'observaciones' ? 500 : name === 'numeroYapePlin' || name === 'celular' ? 20 : 100} multiline={multiline} onBlur={onBlur} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={[styles.input, multiline && styles.textarea, error && styles.inputError]} value={value} />} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

function SavedModal({ visible, clientName, onContinue }: { visible: boolean; clientName: string; onContinue: () => void }) {
  return <Modal animationType="fade" onRequestClose={onContinue} statusBarTranslucent transparent visible={visible}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.savedIcon}><Ionicons color="#FFFFFF" name="checkmark" size={34} /></View><Text style={styles.savedTitle}>Cambios guardados</Text><Text style={styles.savedText}>El perfil de {clientName} se actualizó correctamente.</Text><View style={styles.savedNotice}><Ionicons color={colors.success} name="shield-checkmark-outline" size={18} /><Text style={styles.savedNoticeText}>Su historial financiero se mantiene sin cambios.</Text></View><Pressable onPress={onContinue} style={styles.continueButton}><Text style={styles.continueText}>Volver al cliente</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /></Pressable></View></View></Modal>;
}

function titleCase(value: string) { return value.charAt(0) + value.slice(1).toLocaleLowerCase('es-PE'); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold }, scroll: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: 48, gap: spacing.xl, boxSizing: 'border-box' },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl }, centerTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold }, centerText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, textAlign: 'center', maxWidth: 350 }, errorIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, backButton: { padding: spacing.md }, backText: { color: colors.primary, fontSize: 14, fontFamily: fonts.bold },
  profileCard: { minHeight: 106, borderRadius: radii.xl, backgroundColor: colors.navy, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.card }, avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.extraBold }, profileCopy: { flex: 1, minWidth: 0 }, profileLabel: { color: '#AAB7D8', fontSize: 10, letterSpacing: 1, fontFamily: fonts.extraBold }, profileName: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.extraBold, marginTop: 4 }, profileHint: { color: '#FFFFFF9E', fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, marginTop: 3 }, secure: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg, ...shadows.card }, sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xs }, sectionIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.extraBold }, sectionSubtitle: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.regular, marginTop: 3 }, fieldGroup: { gap: 7 }, label: { color: colors.text, fontSize: 14, fontFamily: fonts.bold }, input: { minHeight: 51, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md, fontSize: 16, fontFamily: fonts.regular }, textarea: { minHeight: 94, paddingTop: spacing.md, textAlignVertical: 'top' }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 12, fontFamily: fonts.medium }, methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, methodChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: radii.round, paddingHorizontal: 12 }, methodChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, methodText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.semibold }, methodTextActive: { color: colors.primary },
  audit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, backgroundColor: colors.primarySoft, padding: spacing.lg }, auditCopy: { flex: 1 }, auditTitle: { color: colors.primaryDark, fontSize: 13, fontFamily: fonts.bold }, auditText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: fonts.regular, marginTop: 3 }, saveButton: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, ...shadows.card }, saveText: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.bold }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, backgroundColor: '#10142699', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, modalCard: { width: '100%', maxWidth: 390, borderRadius: radii.xl, backgroundColor: colors.surface, padding: spacing.xxl, alignItems: 'center', ...shadows.card }, savedIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }, savedTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.extraBold }, savedText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: fonts.regular, textAlign: 'center', marginTop: spacing.sm }, savedNotice: { width: '100%', borderRadius: radii.md, backgroundColor: colors.successSoft, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xl }, savedNoticeText: { flex: 1, color: colors.success, fontSize: 11, lineHeight: 17, fontFamily: fonts.semibold }, continueButton: { width: '100%', minHeight: 52, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, continueText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bold },
});
