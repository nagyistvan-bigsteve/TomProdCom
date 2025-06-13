import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function cuiValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value?.toString().trim();

    if (!value) {
      return null;
    }

    const regex = /^(RO)?\d{2,10}$/;

    if (!regex.test(value)) {
      return { invalidCui: true };
    }

    return null;
  };
}
