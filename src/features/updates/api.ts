import type { Tables } from '@/types/database';
import { supabase } from '@/lib/supabase';

export type NativeAppRelease = Tables<'versiones_app'>;

export async function getActiveNativeRelease(platform: 'android' | 'ios') {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('versiones_app')
    .select('*')
    .eq('plataforma', platform)
    .eq('activa', true)
    .order('publicada_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
