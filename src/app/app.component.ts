import { Component, inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { Language } from './models/enums';
import { RouterModule } from '@angular/router';
import { TopbarComponent } from './components/app-container/topbar/topbar.component';
import { BottomNavbarComponent } from './components/app-container/bottom-navbar/bottom-navbar.component';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { useAuthStore } from './services/store/auth-store';

const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey
);

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [
    MatButtonModule,
    RouterModule,
    TopbarComponent,
    BottomNavbarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private translateService = inject(TranslateService);
  public readonly authStore = inject(useAuthStore);

  ngOnInit(): void {
    const savedLang = localStorage.getItem('selectedLanguage') || Language.RO;
    this.translateService.setDefaultLang(savedLang);
    this.translateService.use(savedLang);
  }
}
