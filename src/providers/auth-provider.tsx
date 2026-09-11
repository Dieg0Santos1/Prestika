import type { Session, User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query-client';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  sendEmailCode: (email: string, createAccount: boolean, profile?: RegistrationProfile) => Promise<void>;
  verifyEmailCode: (email: string, token: string, profile?: RegistrationProfile) => Promise<void>;
  signOut: () => Promise<void>;
};

export type RegistrationProfile = {
  nombre: string;
  celular: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    async sendEmailCode(email, createAccount, profile) {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: createAccount,
          data: profile ? { nombre: profile.nombre, celular: profile.celular } : undefined,
        },
      });
      if (error) throw error;
    },
    async verifyEmailCode(email, token, profile) {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw error;
      if (!data.user) throw new Error('No pudimos crear la sesión en este dispositivo.');
      if (profile) {
        const { error: profileError } = await supabase.from('usuarios').upsert({
          id: data.user.id,
          nombre: profile.nombre.trim(),
          celular: profile.celular.trim(),
        });
        if (profileError) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('El correo se verificó, pero no pudimos guardar tu perfil. Inténtalo nuevamente.');
        }
      }
    },
    async signOut() {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      queryClient.clear();
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return value;
}
