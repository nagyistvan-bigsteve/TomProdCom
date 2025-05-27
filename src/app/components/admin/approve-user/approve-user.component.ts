import { Component, inject } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { useAuthStore } from '../../../services/store/auth-store';
import { CommonModule } from '@angular/common';
import { ENTER_ANIMATION } from '../../../models/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-approve-user',
  imports: [
    MatAccordion,
    MatExpansionModule,
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
  public readonly authStore = inject(useAuthStore);
  unapprovedUsers = this.authStore.fetchUnapprovedUsers();

  approveUser(id: string) {
    this.authStore.approveUser(id).then(() => {
      this.unapprovedUsers = this.authStore.fetchUnapprovedUsers();
    });
  }

  denieUser(id: string) {
    this.authStore.denieUser(id).then(() => {
      this.unapprovedUsers = this.authStore.fetchUnapprovedUsers();
    });
  }
}
