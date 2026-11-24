import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { LanguageService } from '@core/services/language.service';
import { RouterModule } from '@angular/router';
import { TopbarComponent } from '@shared/components/layout/topbar/topbar.component';
import { useAuthStore } from '@core/store/auth-store';
import { AppVersionService } from '@core/services/app-version.service';
import { SidebarComponent } from '@shared/components/layout/sidebar/sidebar.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SupabaseService } from '@core/services/supabase.service';
import { apiErrorKey } from '@core/services/api-error.util';
import { NotificationService } from '@shared/utils/notification.service';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [MatButtonModule, RouterModule, TopbarComponent, SidebarComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private language = inject(LanguageService);
  readonly authStore = inject(useAuthStore);
  private appVersion = inject(AppVersionService);
  private supabaseService = inject(SupabaseService);
  private notify = inject(NotificationService);

  isSidebarOpen = false;

  constructor() {
    // One place that tells the user about any failed data request
    this.supabaseService.apiFailures$
      .pipe(takeUntilDestroyed())
      .subscribe((failure) => this.notify.error(apiErrorKey(failure)));
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  ngOnInit(): void {
    this.appVersion.checkAndReloadIfNeeded();
    this.language.init();

    // Keys used by older versions to remember the open order; now in the URL
    localStorage.removeItem('on-offer-details-page');
    localStorage.removeItem('on-order-details-page');
  }
}
