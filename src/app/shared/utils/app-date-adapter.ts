import { Injectable, Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_NATIVE_DATE_FORMATS,
  NativeDateAdapter,
} from '@angular/material/core';
import { isYearFirstLocale, parseTypedDate } from './typed-date.util';

/**
 * The native date adapter, but a typed date is read in the picker's locale
 * order (Romanian day first, Hungarian year first) instead of the browser's
 * month-first `Date.parse`. Text that is not a real day becomes an invalid
 * date, so the field shows its parse error instead of keeping a wrong value.
 */
@Injectable()
export class AppDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      return parseTypedDate(value, isYearFirstLocale(String(this.locale ?? '')));
    }
    return super.parse(value, parseFormat);
  }
}

/** Use in place of `provideNativeDateAdapter()`, together with `syncDatePickerLocale()`. */
export function provideAppDateAdapter(): Provider[] {
  return [
    { provide: DateAdapter, useClass: AppDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ];
}
