import { Component, DestroyRef, inject, Input, OnInit } from '@angular/core';
import { LanguageSwitcherComponent } from '../language-swicher/language-switcher.component';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule, Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ENTER_AND_LEAVE_ANIMATION } from '../../../models/animations';
import { useAuthStore } from '../../../services/store/auth-store';
import { Router } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { InstallService } from '../../../services/install.service';
import { ReactiveStorageService } from '../../../services/utils/reactive-storage.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-topbar',
  imports: [
    LanguageSwitcherComponent,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    CommonModule,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  animations: [ENTER_AND_LEAVE_ANIMATION],
})
export class TopbarComponent implements OnInit {
  @Input() isAuthenticated: boolean = true;

  private storage = inject(ReactiveStorageService);
  private location = inject(Location);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  public authStore = inject(useAuthStore);
  public installService = inject(InstallService);

  isOnDetailsPage = false;

  ngOnInit(): void {
    this.authStore.fetchUnapprovedUsers();

    this.storage
      .getValue$('on-details-page')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.isOnDetailsPage = value === 'true';
      });
  }

  installApp(): void {
    this.installService.promptInstall();
  }

  goBack(): void {
    if (this.isOnDetailsPage) {
      this.storage.removeValue('on-details-page');
    } else {
      this.location.back();
    }
  }

  goToUserPage(): void {
    this.router.navigate(['/user']);
  }

  goToSettingsPage(): void {
    this.router.navigate(['/settings']);
  }

  goToComingWaresPage(): void {
    this.router.navigate(['/coming-wares']);
  }
}
