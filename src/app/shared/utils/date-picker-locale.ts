import { effect, inject } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { LanguageService } from '@core/services/language.service';
import { datePickerLocale } from './display-format.util';

/**
 * Keeps the component's date picker in the UI language's date format
 * (Romanian 24.11.2026, Hungarian 2026. 11. 24.). Call in the constructor of
 * a component that provides a date adapter (`provideNativeDateAdapter()`).
 */
export function syncDatePickerLocale(): void {
  const adapter = inject(DateAdapter);
  const language = inject(LanguageService);
  effect(() => adapter.setLocale(datePickerLocale(language.current())));
}
