import { Component, inject, OnInit } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Language } from '../../../models/enums';

@Component({
  selector: 'app-language-switcher',
  imports: [MatSlideToggleModule, TranslateModule],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss'],
})
export class LanguageSwitcherComponent implements OnInit {
  currentLanguage: Language = Language.RO;
  readonly translate = inject(TranslateService);

  ngOnInit(): void {
    const savedLang =
      (localStorage.getItem('selectedLanguage') as Language) || Language.RO;
    this.currentLanguage = savedLang;
    this.translate.use(savedLang);
  }

  toggleLanguage() {
    this.currentLanguage =
      this.currentLanguage === Language.RO ? Language.HU : Language.RO;
    this.translate.use(this.currentLanguage);
    localStorage.setItem('selectedLanguage', this.currentLanguage);
  }
}
