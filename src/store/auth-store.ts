import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  company_id: string | null;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  platform_role: 'super_admin' | 'company_admin' | 'hr_manager' | 'recruiter' | 'user';
  is_active: boolean;
  last_login_at: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        const profile = data as unknown as Profile;
        set({ profile });
        return profile;
      }
      return null;
    } catch (err) {
      console.warn('Error fetching profile:', err);
      return null;
    }
  },

  initialize: async () => {
    try {
      // Unsubscribe existing listener to prevent duplicate leak
      if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
      }

      // Set up auth listener BEFORE getting session
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        set({ session, user: session?.user ?? null });

        if (event === 'PASSWORD_RECOVERY') {
          if (window.location.pathname !== '/reset-password') {
            window.location.href = '/reset-password';
            return;
          }
        }

        if (event === 'SIGNED_OUT') {
          set({ profile: null, session: null, user: null });
          try {
            localStorage.removeItem('sb-auth-token');
          } catch {}
          return;
        }

        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            get().fetchProfile(session.user.id).catch(() => {});
          }, 0);

          if (event === 'SIGNED_IN') {
            import('@/utils/loginLogger').then(({ recordUserLogin }) => {
              recordUserLogin('success', 'session_auth');
            }).catch(() => {});
          }
        } else {
          set({ profile: null });
        }
      });
      authSubscription = subscription;

      // Attempt to retrieve session with a timeout to prevent hanging on network/server freeze
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Session retrieval timed out')), 8000)
        );

        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as {
          data: { session: Session | null };
          error?: { message?: string; status?: number } | null;
        };

        if (error) {
          console.warn('Session retrieval error:', error.message);
          try {
            localStorage.removeItem('sb-auth-token');
          } catch {}
          set({ session: null, user: null, profile: null });
        } else {
          const session = data?.session ?? null;
          set({ session, user: session?.user ?? null });

          if (session?.user) {
            await get().fetchProfile(session.user.id);
          }
        }
      } catch (err) {
        console.warn('Supabase session initialization timed out or failed:', err);
        try {
          localStorage.removeItem('sb-auth-token');
        } catch {}
        set({ session: null, user: null, profile: null });
      }
    } catch (err) {
      console.error('Fatal error during auth initialization:', err);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signOut: async () => {
    try {
      // Do not unsubscribe authSubscription on sign out so that future auth changes
      // (such as logging back in) continue to update the reactive Zustand store.
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      try {
        localStorage.removeItem('sb-auth-token');
      } catch {}
      set({ user: null, session: null, profile: null });
    }
  },
}));
