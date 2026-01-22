import { Component, inject, OnInit } from '@angular/core';
import { useAuthStore } from '../../../services/store/auth-store';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { ENTER_ANIMATION } from '../../../models/animations';
import { ApproveUserComponent } from '../../../components/admin/approve-user/approve-user.component';
import { UsersListComponent } from '../../../components/admin/users-list/users-list.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-user',
  imports: [
    MatButtonModule,
    CommonModule,
    ApproveUserComponent,
    UsersListComponent,
    TranslateModule,
  ],
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss',
  animations: [ENTER_ANIMATION],
})
export class UserComponent {
  public readonly authStore = inject(useAuthStore);
  unaprovedUsers = this.authStore.fetchUnapprovedUsers();
}
