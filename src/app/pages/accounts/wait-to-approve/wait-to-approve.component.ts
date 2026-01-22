import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { ENTER_ANIMATION } from '../../../models/animations';
import { useAuthStore } from '../../../services/store/auth-store';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-wait-to-approve',
  imports: [MatCardModule, MatButtonModule, TranslateModule],
  templateUrl: './wait-to-approve.component.html',
  styleUrl: './wait-to-approve.component.scss',
  animations: [ENTER_ANIMATION],
})
export class WaitToApproveComponent {
  private router = inject(Router);
  private authStore = inject(useAuthStore);

  tryRefresh(): void {
    this.authStore.refreshUserData();
    this.router.navigate(['/offer']);
  }
}
