import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ENTER_ANIMATION } from '@core/models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { UsersStore } from '@core/store/users.store';

@Component({
  selector: 'app-approve-user',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    TranslateModule,
  ],
  templateUrl: './approve-user.component.html',
  styleUrl: './approve-user.component.scss',
  animations: [ENTER_ANIMATION],
})
export class ApproveUserComponent {
  readonly usersStore = inject(UsersStore);

  approveUser(id: string) {
    this.usersStore.approve(id);
  }

  denieUser(id: string) {
    this.usersStore.deny(id);
  }
}
