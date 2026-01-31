import { PartialStateUpdater } from '@ngrx/signals';
import { ClientSlice } from './client.slice';

export function updateCurrentClientId(
  newClientId: number,
): PartialStateUpdater<ClientSlice> {
  return (_) => ({ currentClientId: newClientId });
}
