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
  signOut: () => Promise<void>;
}

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

  initialize: async () => {
    try {
      // Set up auth listener BEFORE getting session
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ session, user: session?.user ?? null });
        
        if (event === 'PASSWORD_RECOVERY') {
          if (window.location.pathname !== '/reset-password') {
            window.location.href = '/reset-password';
            return;
          }
        }

        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            if (data) set({ profile: data as unknown as Profile });
          }, 0);
        } else {
          set({ profile: null });
        }
      });

      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (data) set({ profile: data as unknown as Profile });
      }
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },
}));
