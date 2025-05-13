import { Component, inject, Input, OnInit } from '@angular/core';
import { LanguageSwitcherComponent } from '../language-swicher/language-switcher.component';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule, Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ENTER_AND_LEAVE_ANIMATION } from '../../../models/animations';
import { useAuthStore } from '../../../services/store/auth-store';
import { Router } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';

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
  private location = inject(Location);
  private router = inject(Router);
  public authStore = inject(useAuthStore);

  ngOnInit(): void {
    this.authStore.fetchUnapprovedUsers();
  }

  goBack(): void {
    this.location.back();
  }

  goToUserPage(): void {
    this.router.navigate(['/user']);
  }

  goToSettingsPage(): void {
    this.router.navigate(['/settings']);
  }
}
