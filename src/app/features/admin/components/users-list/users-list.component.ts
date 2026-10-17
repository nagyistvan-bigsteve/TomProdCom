import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { useAuthStore, UserRole } from '@core/store/auth-store';
import { UsersStore } from '@core/store/users.store';

import { ENTER_ANIMATION } from '@core/models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';

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

  changeUserRole(id: string, oldRole: UserRole) {
    this.usersStore.toggleRole(id, oldRole);
  }
}
