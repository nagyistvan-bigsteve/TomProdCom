import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Language } from '@core/models/enums';
import { LanguageService } from '@core/services/language.service';

@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./language-switcher.component.scss'],
})
export class LanguageSwitcherComponent {
  private readonly language = inject(LanguageService);
  readonly isHungarian = computed(() => this.language.current() === Language.HU);

  toggleLanguage(): void {
    this.language.toggle();
  }
}
