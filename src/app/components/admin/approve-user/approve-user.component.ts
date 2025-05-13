import { Component, inject } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { useAuthStore } from '../../../services/store/auth-store';
import { CommonModule } from '@angular/common';
import { ENTER_ANIMATION } from '../../../models/animations';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-approve-user',
  imports: [MatAccordion, MatExpansionModule, CommonModule, MatButtonModule],
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
}
