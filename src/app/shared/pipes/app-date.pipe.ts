import { formatDate } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '@core/services/language.service';
import { DateFormatKind, dateFormatFor } from '@shared/utils/display-format.util';

/**
 * A date in the current UI language's format (`dateFormatFor`):
 * `{{ order.dateOrderPlaced | appDate }}`, `| appDate: 'dateTime'`, `| appDate: 'short'`.
 * Impure so it follows a language switch.
 */
@Pipe({ name: 'appDate', pure: false })
export class AppDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  private readonly locale = inject(LOCALE_ID);

  transform(value: Date | string | number | null | undefined, kind: DateFormatKind = 'date'): string {
    if (value === null || value === undefined || value === '') return '';
    return formatDate(value, dateFormatFor(this.language.current(), kind), this.locale);
  }
}
