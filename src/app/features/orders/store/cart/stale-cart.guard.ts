import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { useAuthStore } from '@core/store/auth-store';
import { ConfirmRestoreDialogComponent } from '@shared/components/dialogs/confirm-restore-dialog.component';
import { CartStore } from './cart.store';

/**
 * On the offer creation pages: if a saved cart older than 10 minutes is
 * waiting, asks whether to restore or discard it before the page opens.
 * Never blocks navigation.
 */
export const staleCartGuard: CanActivateFn = async () => {
  const authStore = inject(useAuthStore);
  // Signed-out or unapproved users are redirected by authGuard; don't ask them
  if (!authStore.isAuthenticated() || !authStore.approved()) return true;

  const cartStore = inject(CartStore);
  const pending = cartStore.pendingRestore();
  if (!pending) return true;

  const keep = await firstValueFrom(
    inject(MatDialog)
      .open(ConfirmRestoreDialogComponent, {
        data: { lastUpdated: pending.lastUpdated ? new Date(pending.lastUpdated) : null },
        disableClose: true,
      })
      .afterClosed(),
  );

  if (keep) {
    cartStore.restorePendingCart();
  } else {
    cartStore.discardPendingCart();
  }

  return true;
};
