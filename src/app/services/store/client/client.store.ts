import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
  type,
  withProps,
} from '@ngrx/signals';
import { initialClientSlice } from './client.slice';
import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withBusy } from '../custom-features/with-busy/with-busy.feature';
import { Client } from '../../../models/models';
import { pipe, switchMap, tap } from 'rxjs';
import {
  setBusy,
  setIdle,
} from '../custom-features/with-busy/with-busy.updaters';
import { ClientsService } from '../../query-services/client.service';
import {
  entityConfig,
  setAllEntities,
  updateEntity,
  withEntities,
  addEntity,
} from '@ngrx/signals/entities';
import { updateCurrentClientId } from './client.updaters';
import { ClientType } from '../../../models/enums';

const clientConfig = entityConfig({
  entity: type<Client>(),
  collection: 'clients',
  selectId: (client) => client.id,
});

export const ClientStore = signalStore(
  withState(initialClientSlice),
  withBusy(),
  withProps((_) => {
    const _clientService = inject(ClientsService);
    return { _clientService };
  }),
  withEntities(clientConfig),
  withComputed((store) => ({
    client: computed(() => store.clientsEntityMap()[store.currentClientId()]),
    isClientSelected: computed(() => store.currentClientId() !== -1),
    isClientPJ: computed(
      () =>
        store.clientsEntityMap()[store.currentClientId()].type ===
        ClientType.PJ,
    ),
  })),
  withMethods((store) => {
    return {
      setClientId: (newId: number) =>
        patchState(store, updateCurrentClientId(newId)),

      fetchClients: rxMethod<void>(
        pipe(
          tap(() => patchState(store, setBusy())),
          switchMap(() =>
            store._clientService.getClients().pipe(
              tapResponse({
                next: (clients) =>
                  patchState(store, setAllEntities(clients, clientConfig)),
                error: (error) => console.error(error),
                finalize: () => patchState(store, setIdle()),
              }),
            ),
          ),
        ),
      ),

      updateClient: rxMethod<Client>(
        pipe(
          tap(() => patchState(store, setBusy())),
          switchMap((client) =>
            store._clientService.updateClient(client).pipe(
              tapResponse({
                next: (updatedClient) =>
                  patchState(
                    store,
                    updateEntity(
                      { id: updatedClient.id, changes: updatedClient },
                      clientConfig,
                    ),
                  ),
                error: (error) => console.error(error),
                finalize: () => patchState(store, setIdle()),
              }),
            ),
          ),
        ),
      ),

      addClient: rxMethod<Client>(
        pipe(
          tap(() => patchState(store, setBusy())),
          switchMap((client) =>
            store._clientService.addClient(client).pipe(
              tapResponse({
                next: (newClient: Client) =>
                  patchState(store, addEntity(newClient, clientConfig)),
                error: (error) => console.error(error),
                finalize: () => patchState(store, setIdle()),
              }),
            ),
          ),
        ),
      ),
    };
  }),
  withHooks((store) => ({
    onInit: () => store.fetchClients(),
  })),
);
