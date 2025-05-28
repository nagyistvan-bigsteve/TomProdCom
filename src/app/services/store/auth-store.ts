import {
  signalStore,
  withHooks,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../../models/models';
import { SupabaseService } from '../supabase.service';

export type UserRole = 'user' | 'admin' | null;

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  role: UserRole;
  approved: boolean;
  name: string | null;
  id: string | null;
  unapprovedUsersNumber: number | null;
}

export const useAuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({
    isAuthenticated: false,
    email: null,
    role: null,
    approved: false,
    name: null,
    id: null,
    unapprovedUsersNumber: null,
  }),
  withMethods((store) => {
    const router = inject(Router);
    const supabaseService = inject(SupabaseService);

    // Helper function to persist state to localStorage
    const persistState = () => {
      // Access current state values individually
      const state = {
        isAuthenticated: store.isAuthenticated(),
        email: store.email(),
        role: store.role(),
        approved: store.approved(),
        id: store.id(),
        unapprovedUsersNumber: store.unapprovedUsersNumber(),
      };
      localStorage.setItem('auth', JSON.stringify(state));
    };

    return {
      async signup(email: string, password: string, userName: string) {
        try {
          const { data: authData, error: authError } =
            await supabaseService.client.auth.signUp({
              email,
              password,
            });

          if (authError) throw authError;

          const userId = authData.user?.id;
          if (!userId) throw new Error('User ID not found after signup');

          const { error: profileError } = await supabaseService.client
            .from('profiles')
            .insert({
              id: userId,
              email,
              role: 'user',
              approved: false,
              name: userName,
            });

          if (profileError) {
            await supabaseService.client.auth.admin.deleteUser(userId);
            throw profileError;
          }

          patchState(store, {
            isAuthenticated: true,
            email,
            role: 'user',
            approved: false,
            name: userName,
            id: userId,
          });

          persistState();
          return { success: true, userId };
        } catch (error) {
          console.error('Signup error:', error);
          return { success: false, error };
        }
      },

      async login(email: string, password: string) {
        try {
          const { data, error } =
            await supabaseService.client.auth.signInWithPassword({
              email,
              password,
            });

          if (error) throw error;

          const userId = data.user.id;

          const { data: userData, error: userError } =
            await supabaseService.client
              .from('profiles')
              .select('role, approved, email, name')
              .eq('id', userId)
              .single();

          if (userError) throw userError;

          patchState(store, {
            isAuthenticated: true,
            email: userData.email,
            role: userData.role,
            approved: userData.approved,
            name: userData.name,
            id: userId,
          });

          persistState();
          return { success: true };
        } catch (error) {
          console.error('Login error:', error);
          return { success: false, error };
        }
      },

      async logout() {
        try {
          await supabaseService.client.auth.signOut().then(() => {
            router.navigate(['/auth']);
          });

          patchState(store, {
            isAuthenticated: false,
            email: null,
            role: null,
            approved: false,
            name: null,
            id: null,
          });

          localStorage.removeItem('auth');
          return { success: true };
        } catch (error) {
          console.error('Logout error:', error);
          return { success: false, error };
        }
      },

      async refreshUserData() {
        try {
          const id = store.id();
          if (!id) return { success: false, error: 'Not authenticated' };

          const { data, error } = await supabaseService.client
            .from('profiles')
            .select('role, approved, email, name')
            .eq('id', id)
            .single();

          if (error) throw error;

          patchState(store, {
            email: data.email,
            role: data.role,
            approved: data.approved,
            name: data.name,
          });

          persistState();
          return { success: true };
        } catch (error) {
          console.error('Refresh user data error:', error);
          return { success: false, error };
        }
      },

      async fetchUsers() {
        try {
          const { data, error } = await supabaseService.client
            .from('profiles')
            .select('*')
            .eq('approved', true);
          if (error) throw error;
          return data as User[];
        } catch (error) {
          console.error('Fail to fetch users', error);
          return;
        }
      },

      async fetchUnapprovedUsers() {
        try {
          const { data, error } = await supabaseService.client
            .from('profiles')
            .select('*')
            .eq('approved', false);

          if (error) throw error;

          patchState(store, {
            unapprovedUsersNumber: data.length,
          });

          persistState();
          return data as User[];
        } catch (error) {
          console.error('Fail to fetch unapproved users', error);
          return;
        }
      },

      async approveUser(id: string) {
        try {
          const { data, error } = await supabaseService.client
            .from('profiles')
            .update({ approved: true })
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

          patchState(store, {
            unapprovedUsersNumber: store.unapprovedUsersNumber()! - 1,
          });

          persistState();

          return data;
        } catch (error) {
          console.error('Failed to approve user: ', error);
          return;
        }
      },

      async denieUser(id: string) {
        try {
          const { data, error } = await supabaseService.client
            .from('profiles')
            .delete()
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

          console.log(data);

          patchState(store, {
            unapprovedUsersNumber: store.unapprovedUsersNumber()! - 1,
          });

          persistState();

          return data;
        } catch (error) {
          console.error('Failed to denie user: ', error);
          return;
        }
      },

      async changeRoleForUser(id: string, oldRole: UserRole) {
        const newRole = oldRole === 'user' ? 'admin' : 'user';

        try {
          const { data, error } = await supabaseService.client
            .from('profiles')
            .update({ role: newRole })
            .eq('id', id)
            .select()
            .single();

          if (error) throw error;

          if (newRole === 'admin') {
            const { error } = await supabaseService.client
              .from('admin_users')
              .insert({ id: id });

            if (error) throw error;
          } else {
            const { error } = await supabaseService.client
              .from('admin_users')
              .delete()
              .eq('id', id);

            if (error) throw error;
          }

          return data;
        } catch (error) {
          console.error('Failed to update user: ', error);
          return;
        }
      },

      async checkSession() {
        try {
          const { data, error } =
            await supabaseService.client.auth.getSession();

          if (error) throw error;

          if (data.session) {
            const userId = data.session.user.id;

            const { data: userData, error: userError } =
              await supabaseService.client
                .from('profiles')
                .select('role, approved, email, name')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            patchState(store, {
              isAuthenticated: true,
              email: userData.email,
              role: userData.role,
              approved: userData.approved,
              name: userData.name,
              id: userId,
            });

            persistState();
            return { success: true, isAuthenticated: true };
          }

          return { success: true, isAuthenticated: false };
        } catch (error) {
          console.error('Check session error:', error);
          return { success: false, error, isAuthenticated: false };
        }
      },
    };
  }),
  withHooks((store) => {
    return {
      async onInit() {
        // Restore auth state from localStorage
        const stored = localStorage.getItem('auth');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            patchState(store, parsed);

            // Verify the session is still valid
            const { isAuthenticated } = await store.checkSession();
            if (!isAuthenticated) {
              localStorage.removeItem('auth');
            }
          } catch (e) {
            console.error('Failed to parse stored auth data', e);
            localStorage.removeItem('auth');
          }
        } else {
          // Check if there's an active session even if no local storage
          store.checkSession();
        }
      },
      onDestroy() {
        // Optional cleanup if needed
      },
    };
  })
);
