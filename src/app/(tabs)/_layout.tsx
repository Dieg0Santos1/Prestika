import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { type ColorValue, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, shadows } from '@/constants/design';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { useAuth } from '@/providers/auth-provider';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ color, focused, name, selectedName }: { color: ColorValue; focused: boolean; name: IconName; selectedName: IconName }) {
  return <Ionicons color={color} name={focused ? selectedName : name} size={23} />;
}

export default function TabsLayout() {
  const isWide = useWideLayout();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { loading, session } = useAuth();
  const compact = width < 360;

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: compact ? 10 : 11, lineHeight: compact ? 13 : 15, fontFamily: fonts.semibold, marginTop: 1, textAlign: 'center' },
        tabBarItemStyle: { minWidth: 0 },
        tabBarStyle: {
          display: isWide ? 'none' : 'flex',
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingHorizontal: compact ? 0 : 4,
          ...shadows.tabBar,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: (props) => <TabIcon {...props} name="home-outline" selectedName="home" /> }} />
      <Tabs.Screen name="clientes" options={{ title: 'Clientes', tabBarIcon: (props) => <TabIcon {...props} name="people-outline" selectedName="people" /> }} />
      <Tabs.Screen name="caja" options={{ title: 'Caja', tabBarIcon: (props) => <TabIcon {...props} name="cash-outline" selectedName="cash" /> }} />
      <Tabs.Screen name="prestamos" options={{ title: 'Préstamos', tabBarIcon: (props) => <TabIcon {...props} name="wallet-outline" selectedName="wallet" /> }} />
      <Tabs.Screen name="actividad" options={{ title: 'Actividad', tabBarIcon: (props) => <TabIcon {...props} name="receipt-outline" selectedName="receipt" /> }} />
    </Tabs>
  );
}
