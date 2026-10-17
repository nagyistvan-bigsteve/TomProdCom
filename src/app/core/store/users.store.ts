import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { User } from '@core/models/models';
import { UsersService } from '@core/services/users.service';
import type { UserRole } from './auth-store';

interface UsersState {
  users: User[];
  unapprovedUsers: User[];
}

/**
 * User administration for admins: approved users, users waiting for approval
 * (also the topbar badge), approve / deny and role changes. Kept in memory
 * only. Failures are logged; the app-wide API error toast informs the user.
 */
export const UsersStore = signalStore(
  { providedIn: 'root' },
  withState<UsersState>({ users: [], unapprovedUsers: [] }),
  withComputed((store) => ({
    unapprovedCount: computed(() => store.unapprovedUsers().length),
  })),
  withMethods((store, usersService = inject(UsersService)) => {
    const loadUsers = async (): Promise<void> => {
      try {
        patchState(store, { users: await usersService.getUsers(true) });
      } catch (error) {
        console.error('Fail to fetch users', error);
      }
    };

    const loadUnapprovedUsers = async (): Promise<void> => {
      try {
        patchState(store, {
          unapprovedUsers: await usersService.getUsers(false),
        });
      } catch (error) {
        console.error('Fail to fetch unapproved users', error);
      }
    };

    return {
      loadUsers,
      loadUnapprovedUsers,

      async approve(userId: string): Promise<void> {
        try {
          await usersService.approve(userId);
        } catch (error) {
          console.error('Failed to approve user: ', error);
        }
        await Promise.all([loadUnapprovedUsers(), loadUsers()]);
      },

      async deny(userId: string): Promise<void> {
        try {
          await usersService.deny(userId);
        } catch (error) {
          console.error('Failed to deny user: ', error);
        }
        await loadUnapprovedUsers();
      },

      /** Switches a user between "user" and "admin". */
      async toggleRole(userId: string, currentRole: UserRole): Promise<void> {
        try {
          await usersService.setRole(userId, currentRole === 'user' ? 'admin' : 'user');
        } catch (error) {
          console.error('Failed to update user: ', error);
        }
        await loadUsers();
      },

      clear(): void {
        patchState(store, { users: [], unapprovedUsers: [] });
      },
    };
  }),
);
