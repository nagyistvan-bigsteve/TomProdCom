import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { ENTER_ANIMATION } from '@core/models/animations';
import { useAuthStore } from '@core/store/auth-store';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-wait-to-approve',
  imports: [MatButtonModule, MatIconModule, TranslateModule],
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
