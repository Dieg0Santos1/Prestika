import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, radii, spacing } from '@/constants/design';

export function PrimaryButton({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <LinearGradient colors={['#6E51FA', '#3C6FF8']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.button}>
        <Ionicons color="#FFFFFF" name={icon} size={19} /><Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  label: { color: '#FFFFFF', fontSize: 18, fontFamily: fonts.bold },
  pressed: { opacity: 0.84 },
});
