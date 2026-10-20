
import { useState, useEffect } from 'react';

import { supabase } from './supabase';

import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
// Start loading until the persisted Supabase session is restored, so route
// guards don't flash "sign in required" (or redirect) on app reload.
let globalLoading = true;

let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

let authInitStarted = false;

/** Restore the persisted session once, then keep memory state in sync. */
function ensureAuthInit() {
  if (authInitStarted) return;
  authInitStarted = true;
  const timeout = setTimeout(() => {
    globalLoading = false;
    notify();
  }, 5000);

  supabase.auth
    .getSession()
    .then(({ data }) => {
      clearTimeout(timeout);
      globalSession = data.session ?? null;
      globalUser = data.session?.user ?? null;
      globalLoading = false;
      notify();
    })
    .catch(() => {
      clearTimeout(timeout);
      globalLoading = false;
      notify();
    });
  supabase.auth.onAuthStateChange((_event, session) => {
    setAuth(session);
  });
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    ensureAuthInit();
    const listener = () => forceRender((n) => n + 1);

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher' | 'admin' | 'administrator';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (!error && data.session && profile) {
    await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        role: profile.role,
      })
      .eq('id', data.session.user.id);
  }

  if (!error && data.session) {
    setAuth(data.session);
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!error && data.session) {
    setAuth(data.session);
  }

  return { data, error };
}

export async function signOut() {
  setAuth(null);
  supabase.auth.signOut().catch(() => {});

  return { error: null };
}
