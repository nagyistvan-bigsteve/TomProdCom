import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { ENTER_ANIMATION } from '@core/models/animations';
import { useAuthStore } from '@core/store/auth-store';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '@shared/utils/notification.service';

@Component({
  selector: 'app-wait-to-approve',
  imports: [MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './wait-to-approve.component.html',
  styleUrl: './wait-to-approve.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_ANIMATION],
})
export class WaitToApproveComponent {
  private router = inject(Router);
  private authStore = inject(useAuthStore);
  private notification = inject(NotificationService);

  /** Reads the approval again; the guard keeps the user here while it is still pending. */
  async tryRefresh(): Promise<void> {
    const result = await this.authStore.refreshUserData();
    if ('accountRemoved' in result && result.accountRemoved) {
      // The store has already signed out and opened /auth
      this.notification.error('AUTH.WAIT_TO_APPROVE.ACCOUNT_REMOVED');
      return;
    }
    this.router.navigate(['/offer']);
  }

  logout(): void {
    this.authStore.logout();
  }
}
