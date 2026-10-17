import {
  signalStore,
  withHooks,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { resolveDisplayName } from './display-name.util';
import { shouldResetCachedAuth } from './auth-session.util';
import { readFromLocalStorage, syncToLocalStorage } from './local-storage-sync';
import { UsersStore } from './users.store';

export type UserRole = 'user' | 'admin' | null;

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  role: UserRole;
  approved: boolean;
  name: string | null;
  id: string | null;
}

const STORAGE_KEY = 'auth';

const signedOut: AuthState = {
  isAuthenticated: false,
  email: null,
  role: null,
  approved: false,
  name: null,
  id: null,
};

export const useAuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(signedOut),
  withMethods((store) => {
    const router = inject(Router);
    const authService = inject(AuthService);
    const usersStore = inject(UsersStore);

    const resetState = () => {
      patchState(store, signedOut);
      usersStore.clear();
    };

    return {
      // Drops the cached login when Supabase has no session behind it
      clearStaleSession() {
        resetState();
        // The reset-password page is public and must stay reachable from the email link
        if (!window.location.pathname.startsWith('/reset-password')) {
          router.navigate(['/auth']);
        }
      },

      async signup(email: string, password: string, userName: string) {
        try {
          const user = await authService.signUp(email, password, userName);

          const userId = user?.id;
          if (!userId) throw new Error('User ID not found after signup');

          patchState(store, {
            isAuthenticated: true,
            email,
            role: 'user',
            approved: false,
            name: userName,
            id: userId,
          });

          return { success: true, userId };
        } catch (error) {
          console.error('Signup error:', error);
          return { success: false, error };
        }
      },

      async login(email: string, password: string) {
        try {
          const user = await authService.signIn(email, password);
          const profile = await authService.getProfile(user.id);

          patchState(store, {
            isAuthenticated: true,
            email: profile.email,
            role: profile.role,
            approved: profile.approved,
            name: resolveDisplayName(
              profile.name,
              user.user_metadata?.['name'],
              profile.email,
            ),
            id: user.id,
          });

          return { success: true };
        } catch (error) {
          console.error('Login error:', error);
          return { success: false, error };
        }
      },

      async logout() {
        try {
          await authService.signOut();
          router.navigate(['/auth']);

          resetState();
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

          const profile = await authService.getProfile(id);

          patchState(store, {
            email: profile.email,
            role: profile.role,
            approved: profile.approved,
            name: resolveDisplayName(profile.name, store.name(), profile.email),
          });

          return { success: true };
        } catch (error) {
          console.error('Refresh user data error:', error);
          return { success: false, error };
        }
      },

      async checkSession() {
        try {
          const session = await authService.getSession();

          if (session) {
            const userId = session.user.id;
            const profile = await authService.getProfile(userId);

            patchState(store, {
              isAuthenticated: true,
              email: profile.email,
              role: profile.role,
              approved: profile.approved,
              name: resolveDisplayName(
                profile.name,
                session.user.user_metadata?.['name'],
                profile.email,
              ),
              id: userId,
            });

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
        // Cached login: a startup hint only, verified against Supabase below.
        // Must be set up before the first await (needs the injection context).
        syncToLocalStorage(STORAGE_KEY, () =>
          store.isAuthenticated()
            ? {
                isAuthenticated: true,
                email: store.email(),
                role: store.role(),
                approved: store.approved(),
                name: store.name(),
                id: store.id(),
              }
            : null,
        );

        const stored = readFromLocalStorage<Partial<AuthState>>(STORAGE_KEY);

        if (stored) {
          patchState(store, {
            isAuthenticated: stored.isAuthenticated ?? false,
            email: stored.email ?? null,
            role: stored.role ?? null,
            approved: stored.approved ?? false,
            name: stored.name ?? null,
            id: stored.id ?? null,
          });

          // Verify the session is still valid
          const result = await store.checkSession();
          if (shouldResetCachedAuth(result)) {
            store.clearStaleSession();
          }
        } else {
          // Check if there's an active session even if no local storage
          store.checkSession();
        }
      },
    };
  }),
);
