import { Component, inject, OnInit } from '@angular/core';
import { useAuthStore } from '@core/store/auth-store';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { ENTER_ANIMATION } from '@core/models/animations';
import { ApproveUserComponent } from '@features/admin/components/approve-user/approve-user.component';
import { UsersListComponent } from '@features/admin/components/users-list/users-list.component';
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
