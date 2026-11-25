import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { useAuthStore } from '@core/store/auth-store';
import { UsersStore } from '@core/store/users.store';
import { User } from '@core/models/models';

import { ENTER_ANIMATION } from '@core/models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmDeleteDialogComponent } from '@shared/components/dialogs/confirm-delete-dialog.component';
import { NotificationService } from '@shared/utils/notification.service';

@Component({
  selector: 'app-users-list',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    TranslateModule
],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_ANIMATION],
})
export class UsersListComponent {
  public readonly authStore = inject(useAuthStore);
  readonly usersStore = inject(UsersStore);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Promotes or demotes after a confirmation, then confirms with a toast. */
  changeUserRole(user: User) {
    const promote = user.role === 'user';
    const name = user.name || user.email;

    this.dialog
      .open(ConfirmDeleteDialogComponent, {
        data: {
          title: 'USER.USER_LIST.TITLE',
          message: promote ? 'USER.USER_LIST.CONFIRM_PROMOTE' : 'USER.USER_LIST.CONFIRM_DEMOTE',
          messageParams: { name },
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (confirmed) => {
        if (confirmed !== true) return;
        if (await this.usersStore.toggleRole(user.id, user.role)) {
          this.notification.success(promote ? 'SNACKBAR.USER.PROMOTED' : 'SNACKBAR.USER.DEMOTED', { name });
        }
      });
  }
}
