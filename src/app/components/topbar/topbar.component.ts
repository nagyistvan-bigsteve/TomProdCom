import { Component } from '@angular/core';
import { LanguageSwitcherComponent } from '../language-swicher/language-switcher.component';

@Component({
  selector: 'app-topbar',
  imports: [LanguageSwitcherComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {}
