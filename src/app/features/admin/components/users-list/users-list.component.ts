import { Component, inject } from '@angular/core';
import { useAuthStore, UserRole } from '@core/store/auth-store';
import { CommonModule } from '@angular/common';
import { ENTER_ANIMATION } from '@core/models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-users-list',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    TranslateModule,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
  animations: [ENTER_ANIMATION],
})
export class UsersListComponent {
  public readonly authStore = inject(useAuthStore);
  usersList = this.authStore.fetchUsers();

  changeUserRole(id: string, oldRole: UserRole) {
    this.authStore.changeRoleForUser(id, oldRole).then(() => {
      this.usersList = this.authStore.fetchUsers();
    });
  }
}
