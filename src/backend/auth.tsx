import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

interface AuthContextValue {
  isBackendConfigured: boolean;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTO_SIGNIN_EMAIL = process.env.EXPO_PUBLIC_AUTO_SIGNIN_EMAIL?.trim().toLowerCase() ?? '';
const AUTO_SIGNIN_PASSWORD = process.env.EXPO_PUBLIC_AUTO_SIGNIN_PASSWORD?.trim() ?? '';
const AUTO_SIGNIN_ENABLED = Boolean(AUTO_SIGNIN_EMAIL && AUTO_SIGNIN_PASSWORD);

const ensureClient = () => {
  if (!supabase) {
    throw new Error('Backend is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return supabase;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    if (__DEV__) {
      console.log(
        `Auth bootstrap: backend=true auto=${Boolean(AUTO_SIGNIN_ENABLED && AUTO_SIGNIN_EMAIL && AUTO_SIGNIN_PASSWORD)}`
      );
    }

    const signInAutoAccount = async () => {
      if (__DEV__) {
        console.log(`Auth bootstrap: attempting auto sign-in for ${AUTO_SIGNIN_EMAIL}.`);
      }

      const autoSignIn = await client.auth.signInWithPassword({
        email: AUTO_SIGNIN_EMAIL,
        password: AUTO_SIGNIN_PASSWORD,
      });

      if (!mounted) {
        return;
      }

      if (autoSignIn.error) {
        console.warn('Auto sign-in failed:', autoSignIn.error.message);
        setSession(null);
      } else {
        if (__DEV__) {
          console.log('Auth bootstrap: auto sign-in successful.');
        }
        setSession(autoSignIn.data.session ?? null);
      }
    };

    const bootstrap = async () => {
      try {
        const { data, error } = await client.auth.getSession();

        if (!mounted) {
          return;
        }

        if (error) {
          setSession(null);
          setLoading(false);
          return;
        }

        if (data.session) {
          if (__DEV__) {
            console.log('Auth bootstrap: existing session found.');
          }

          if (!AUTO_SIGNIN_ENABLED || !AUTO_SIGNIN_EMAIL || !AUTO_SIGNIN_PASSWORD) {
            setSession(data.session);
            setLoading(false);
            return;
          }

          const existingEmail = data.session.user.email?.trim().toLowerCase() ?? '';
          if (existingEmail === AUTO_SIGNIN_EMAIL) {
            setSession(data.session);
            setLoading(false);
            return;
          }

          if (__DEV__) {
            console.log(`Auth bootstrap: switching account from ${existingEmail || '<unknown>'} to ${AUTO_SIGNIN_EMAIL}.`);
          }

          await client.auth.signOut();
          await signInAutoAccount();
          setLoading(false);
          return;
        }

        if (!AUTO_SIGNIN_ENABLED || !AUTO_SIGNIN_EMAIL || !AUTO_SIGNIN_PASSWORD) {
          if (__DEV__) {
            console.log('Auth bootstrap: auto credentials not configured.');
          }
          setSession(null);
          setLoading(false);
          return;
        }

        await signInAutoAccount();

        setLoading(false);
      } catch (err: unknown) {
        if (!mounted) {
          return;
        }

        if (__DEV__) {
          console.warn('Auth bootstrap: network error during getSession:', err instanceof Error ? err.message : err);
        }

        setSession(null);
        setLoading(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isBackendConfigured: isSupabaseConfigured,
      session,
      loading,
      signIn: async (email, password) => {
        const client = ensureClient();
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw new Error(error.message);
        }
      },
      signUp: async (email, password) => {
        const client = ensureClient();
        const { error } = await client.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          throw new Error(error.message);
        }
      },
      signOut: async () => {
        const client = ensureClient();
        const { error } = await client.auth.signOut();
        if (error) {
          throw new Error(error.message);
        }
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
};
