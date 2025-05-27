import { Component, inject, OnInit } from '@angular/core';
import { useAuthStore, UserRole } from '../../../services/store/auth-store';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { ENTER_ANIMATION } from '../../../models/animations';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-users-list',
  imports: [
    MatAccordion,
    MatExpansionModule,
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
