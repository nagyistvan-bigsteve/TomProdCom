import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ClientStore } from '@features/clients/store/client.store';

type ClientStoreType = InstanceType<typeof ClientStore>;

/** Flags a client code (CNP / CUI) already used by another client. */
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
