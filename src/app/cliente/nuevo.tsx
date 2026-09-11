import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth, radii, shadows, spacing } from '@/constants/design';
import { createClient } from '@/features/clientes/api';
import { clientFormSchema, type ClientFormValues } from '@/features/clientes/schema';

const methods = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'] as const;

export default function NewClientScreen() {
  const queryClient = useQueryClient();
  const { control, handleSubmit, formState: { errors } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { nombres: '', apellidos: '', celular: '', metodoPago: '', numeroYapePlin: '', observaciones: '' },
  });
  const selectedMethod = useWatch({ control, name: 'metodoPago' });
  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      router.replace(`/cliente/${client.id}`);
    },
    onError: (error) => Alert.alert('No se pudo guardar', error.message),
  });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topBar}><Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.topButton}><Ionicons color={colors.text} name="close" size={24} /></Pressable><Text style={styles.topTitle}>Nuevo cliente</Text><View style={styles.topButton} /></View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.intro}><View style={styles.introIcon}><Ionicons color={colors.primary} name="person-add-outline" size={24} /></View><View style={styles.introCopy}><Text style={styles.introTitle}>Datos del cliente</Text><Text style={styles.introText}>Solo el nombre es obligatorio. Puedes completar lo demás cuando lo necesites.</Text></View></View>

          <View style={styles.card}>
            <FormField control={control} error={errors.nombres?.message} label="Nombres *" name="nombres" placeholder="Ej. Rudy" />
            <FormField control={control} error={errors.apellidos?.message} label="Apellidos" name="apellidos" placeholder="Ej. Ramírez" />
            <FormField control={control} error={errors.celular?.message} keyboardType="phone-pad" label="Celular" name="celular" placeholder="987 654 321" />

            <View style={styles.fieldGroup}><Text style={styles.label}>Medio preferido</Text><Controller control={control} name="metodoPago" render={({ field: { onChange, value } }) => <View style={styles.methodGrid}>{methods.map((method) => <Pressable key={method} onPress={() => onChange(value === method ? '' : method)} style={[styles.methodChip, value === method && styles.methodChipActive]}><Text style={[styles.methodText, value === method && styles.methodTextActive]}>{method.charAt(0) + method.slice(1).toLocaleLowerCase()}</Text></Pressable>)}</View>} /></View>

            {(selectedMethod === 'YAPE' || selectedMethod === 'PLIN') ? <FormField control={control} error={errors.numeroYapePlin?.message} keyboardType="phone-pad" label={`Número de ${selectedMethod === 'YAPE' ? 'Yape' : 'Plin'}`} name="numeroYapePlin" placeholder="Número asociado" /> : null}
            <FormField control={control} error={errors.observaciones?.message} label="Observaciones" multiline name="observaciones" placeholder="Información adicional del cliente..." />
          </View>

          <Pressable disabled={mutation.isPending} onPress={handleSubmit((values) => mutation.mutate(values))} style={({ pressed }) => [styles.saveButton, (pressed || mutation.isPending) && styles.pressed]}>{mutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={20} /><Text style={styles.saveText}>Guardar cliente</Text></>}</Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldName = 'nombres' | 'apellidos' | 'celular' | 'numeroYapePlin' | 'observaciones';

function FormField({ control, error, label, name, placeholder, keyboardType = 'default', multiline = false }: {
  control: ReturnType<typeof useForm<ClientFormValues>>['control']; error?: string; label: string; name: FieldName;
  placeholder: string; keyboardType?: 'default' | 'phone-pad'; multiline?: boolean;
}) {
  return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><Controller control={control} name={name} render={({ field: { onBlur, onChange, value } }) => <TextInput keyboardType={keyboardType} multiline={multiline} onBlur={onBlur} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={[styles.input, multiline && styles.textarea, error && styles.inputError]} value={value} />} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, topBar: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }, topButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }, topTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold },
  scroll: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: 48, gap: spacing.xl, boxSizing: 'border-box' }, intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, introIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, introCopy: { flex: 1 }, introTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.extraBold }, introText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.lg, ...shadows.card }, fieldGroup: { gap: 7 }, label: { color: colors.text, fontSize: 15, fontFamily: fonts.bold }, input: { minHeight: 50, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md, fontSize: 17, fontFamily: fonts.regular }, textarea: { minHeight: 94, paddingTop: spacing.md, textAlignVertical: 'top' }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 13, fontFamily: fonts.medium },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, methodChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: radii.round, paddingHorizontal: 13, paddingVertical: 9 }, methodChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, methodText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.semibold }, methodTextActive: { color: colors.primary },
  saveButton: { minHeight: 54, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, ...shadows.card }, saveText: { color: '#FFFFFF', fontSize: 17, fontFamily: fonts.bold }, pressed: { opacity: 0.75 },
});
