import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ClientStore } from '@features/clients/store/client.store';
import { normalizeCui } from '@core/guards/cuiValidator';

type ClientStoreType = InstanceType<typeof ClientStore>;

/** Flags a client code (CNP / CUI) already used by another client. */
export function uniqueClientCodeValidator(
  clientStore: ClientStoreType,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeCui(control.value?.toString() ?? '');
    if (!value) return null;

    const clients = Object.values(clientStore.clientsEntityMap());
    const currentId = clientStore.currentClientId();

    // Compared without spaces and case, so "ro 123" matches a saved "RO123"
    const existing = clients.find(
      (c) => !!c.code && normalizeCui(c.code) === value && c.id !== currentId,
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
