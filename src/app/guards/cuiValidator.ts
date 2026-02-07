import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ClientStore } from '../services/store/client/client.store';

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

type ClientStoreType = InstanceType<typeof ClientStore>;

export function uniqueClientCodeValidator(
  clientStore: ClientStoreType,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value?.toString().trim();
    if (!value) return null;

    const clients = Object.values(clientStore.clientsEntityMap());
    const currentId = clientStore.currentClientId();

    const existing = clients.find(
      (c) => c.code === value && c.id !== currentId,
    );

    if (!existing) return null;

    return {
      duplicateCode: {
        clientName: existing.name,
        clientId: existing.id,
      },
    };
  };
}
