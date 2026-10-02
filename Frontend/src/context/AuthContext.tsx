import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { apiClient, setAuthToken } from '../services/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  organization?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBackendProfile = useCallback(async (jwt: string) => {
    try {
      setAuthToken(jwt);
      const res = await apiClient.getMe();
      if (res && res.profile) {
        setProfile(res.profile as unknown as UserProfile);
      }
    } catch (err) {
      console.warn('[MediFusion Auth] Backend profile sync failed:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (mounted && data.session) {
          setSession(data.session);
          setUser(data.session.user);
          setToken(data.session.access_token);
          setAuthToken(data.session.access_token);
          await fetchBackendProfile(data.session.access_token);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Auth initialization failed');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
        setToken(newSession.access_token);
        setAuthToken(newSession.access_token);
        await fetchBackendProfile(newSession.access_token);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setToken(null);
        setAuthToken(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchBackendProfile]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setToken(data.session.access_token);
        setAuthToken(data.session.access_token);
        await fetchBackendProfile(data.session.access_token);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: string = 'clinician',
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setToken(data.session.access_token);
        setAuthToken(data.session.access_token);
        await fetchBackendProfile(data.session.access_token);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setToken(null);
      setAuthToken(null);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchBackendProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        token,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
