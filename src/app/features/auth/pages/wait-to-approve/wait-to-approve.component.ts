import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [ENTER_ANIMATION],
})
export class WaitToApproveComponent {
  private router = inject(Router);
  private authStore = inject(useAuthStore);

  /** Reads the approval again; the guard keeps the user here while it is still pending. */
  async tryRefresh(): Promise<void> {
    await this.authStore.refreshUserData();
    this.router.navigate(['/offer']);
  }

  logout(): void {
    this.authStore.logout();
  }
}
