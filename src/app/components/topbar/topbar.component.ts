import { Component } from '@angular/core';
import { LanguageSwitcherComponent } from '../language-swicher/language-switcher.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-topbar',
  imports: [LanguageSwitcherComponent, TranslateModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {}
