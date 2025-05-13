import {
  signalStore,
  withHooks,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Client } from '../../models/models';

// Define the state interface
interface ClientDataState {
  client: Client | null;
  lastUpdated: string | null;
}

// Local storage key
const STORAGE_KEY = 'client_data';

export const useClientStore = signalStore(
  { providedIn: 'root' },
  withState<ClientDataState>({
    client: null,
    lastUpdated: null,
  }),

  // Methods for state manipulation
  withMethods((store) => {
    // Helper function to persist state to localStorage
    const persistState = () => {
      const state = {
        client: store.client(),
        lastUpdated: store.lastUpdated(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    return {
      // Set client (replaces current client)
      setClient(client: Client) {
        patchState(store, {
          client,
          lastUpdated: new Date().toISOString(),
        });

        persistState();
      },

      // Update client (partial update)
      updateClient(updates: Partial<Client>) {
        const currentClient = store.client();

        if (!currentClient) {
          return;
        }

        const updatedClient = {
          ...currentClient,
          ...updates,
        };

        patchState(store, {
          client: updatedClient,
          lastUpdated: new Date().toISOString(),
        });

        persistState();
      },

      // Delete client
      deleteClient() {
        patchState(store, {
          client: null,
          lastUpdated: new Date().toISOString(),
        });

        localStorage.removeItem(STORAGE_KEY);
      },
    };
  }),

  // Lifecycle hooks
  withHooks((store) => {
    return {
      onInit() {
        // Load state from localStorage on initialization
        const storedData = localStorage.getItem(STORAGE_KEY);

        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            patchState(store, parsedData);
          } catch (e) {
            console.error('Failed to parse stored client data', e);
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      },
      onDestroy() {
        // Optional cleanup if needed
      },
    };
  })
);
