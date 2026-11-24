import { formatNumber } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { moneyDigits } from '@shared/utils/display-format.util';

/** A money amount: `960`, `2.155,50` (two decimals only when there are cents). */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return formatNumber(value, this.locale, moneyDigits(value));
  }
}
