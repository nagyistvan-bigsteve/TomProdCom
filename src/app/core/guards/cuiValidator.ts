import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const CUI_TEST_KEY = '753217532';

/**
 * Whether a Romanian CUI (2–10 digits, optional "RO" prefix) has a valid check
 * digit: the digits before the last one, padded to 9 with leading zeros, are
 * weighted with 753217532; (sum × 10) mod 11 is the check digit, 10 counting as 0.
 */
export function isValidCui(value: string): boolean {
  const match = /^(RO)?(\d{2,10})$/.exec(value);
  if (!match) return false;

  const digits = match[2];
  const body = digits.slice(0, -1).padStart(9, '0');
  const sum = [...body].reduce(
    (total, digit, i) => total + Number(digit) * Number(CUI_TEST_KEY[i]),
    0,
  );
  const check = ((sum * 10) % 11) % 10;

  return check === Number(digits.at(-1));
}

export function cuiValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value?.toString().trim();

    if (!value) {
      return null;
    }

    return isValidCui(value) ? null : { invalidCui: true };
  };
}
