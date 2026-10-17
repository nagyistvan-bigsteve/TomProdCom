import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Language } from '@core/models/enums';
import { parseLanguage } from './language.util';

const STORAGE_KEY = 'selectedLanguage';

/** The UI language: applied to ngx-translate and remembered in localStorage. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly _current = signal(Language.RO);
  readonly current = this._current.asReadonly();

  /** Applies the remembered language. Call once at startup. */
  init(): void {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked: fall back to the default language
    }
    const language = parseLanguage(stored);
    this.translate.setDefaultLang(language);
    this.apply(language);
  }

  toggle(): void {
    const next = this._current() === Language.RO ? Language.HU : Language.RO;
    this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered across reloads; the switch itself still works
    }
  }

  private apply(language: Language): void {
    this._current.set(language);
    this.translate.use(language);
  }
}
