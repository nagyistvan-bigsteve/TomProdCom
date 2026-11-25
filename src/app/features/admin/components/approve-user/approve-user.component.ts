import { Component, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ENTER_ANIMATION } from '@core/models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { User } from '@core/models/models';
import { UsersStore } from '@core/store/users.store';
import { ConfirmDeleteDialogComponent } from '@shared/components/dialogs/confirm-delete-dialog.component';
import { NotificationService } from '@shared/utils/notification.service';

@Component({
  selector: 'app-approve-user',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    TranslateModule
],
  templateUrl: './approve-user.component.html',
  styleUrl: './approve-user.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_ANIMATION],
})
export class ApproveUserComponent {
  readonly usersStore = inject(UsersStore);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  approveUser(user: User) {
    this.confirm('AUTH.APPROVE.CONFIRM_APPROVE', user, false, async () => {
      if (await this.usersStore.approve(user.id)) {
        this.notification.success('SNACKBAR.USER.APPROVED', { name: this.label(user) });
      }
    });
  }

  denyUser(user: User) {
    this.confirm('AUTH.APPROVE.CONFIRM_DENY', user, true, async () => {
      if (await this.usersStore.deny(user.id)) {
        this.notification.success('SNACKBAR.USER.DENIED', { name: this.label(user) });
      }
    });
  }

  private confirm(message: string, user: User, isDangerous: boolean, action: () => void) {
    this.dialog
      .open(ConfirmDeleteDialogComponent, {
        data: {
          title: 'AUTH.APPROVE.TITLE',
          message,
          messageParams: { name: this.label(user) },
          isDangerous,
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed === true) action();
      });
  }

  private label(user: User): string {
    return user.name || user.email;
  }
}
