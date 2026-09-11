import { Platform } from 'react-native';

export const colors = {
  background: '#F7F8FC', surface: '#FFFFFF', surfaceSoft: '#F1F3FA', primary: '#5B45F6',
  primaryDark: '#31217A', primarySoft: '#EFECFF', navy: '#0B1E4B', text: '#171A2B',
  textSecondary: '#62677D', textMuted: '#9297AA', border: '#E8EAF2', success: '#18A66A',
  successSoft: '#E7F8F0', warning: '#EA8C22', warningSoft: '#FFF3E2', danger: '#DE4D5A',
  dangerSoft: '#FDECEF', cyan: '#1CB7C7',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radii = { sm: 10, md: 14, lg: 18, xl: 24, round: 999 } as const;
export const fonts = {
  regular: 'Manrope_400Regular', medium: 'Manrope_500Medium', semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold', extraBold: 'Manrope_800ExtraBold',
} as const;

export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#172154', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 2 },
    web: { boxShadow: '0 8px 28px rgba(23, 33, 84, 0.08)' },
    default: {},
  }),
  tabBar: Platform.select({
    ios: { shadowColor: '#172154', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
    android: { elevation: 10 },
    web: { boxShadow: '0 -4px 20px rgba(23, 33, 84, 0.06)' },
    default: {},
  }),
} as const;

export const maxContentWidth = 1080;
