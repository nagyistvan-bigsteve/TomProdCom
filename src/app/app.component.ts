import { Component, inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { Language } from './models/enums';
import { RouterModule } from '@angular/router';
import { TopbarComponent } from './components/app-container/topbar/topbar.component';
import { useAuthStore } from './services/store/auth-store';
import { AppVersionService } from './services/core/app-version.service';
import { SidebarComponent } from './components/app-container/sidebar/sidebar.component';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [MatButtonModule, RouterModule, TopbarComponent, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private translateService = inject(TranslateService);
  readonly authStore = inject(useAuthStore);
  private appVersion = inject(AppVersionService);

  isSidebarOpen = false;

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  ngOnInit(): void {
    this.appVersion.checkAndReloadIfNeeded();
    const savedLang = localStorage.getItem('selectedLanguage') || Language.RO;
    this.translateService.setDefaultLang(savedLang);
    this.translateService.use(savedLang);

    localStorage.removeItem('on-offer-details-page');
    localStorage.removeItem('on-order-details-page');
  }
}
