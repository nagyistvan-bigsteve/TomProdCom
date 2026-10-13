import { PartialStateUpdater } from '@ngrx/signals';
import { BusySlice } from './with-busy.slice';

export function setBusy(): PartialStateUpdater<BusySlice> {
  return (state) => ({ pendingCount: state.pendingCount + 1 });
}

export function setIdle(): PartialStateUpdater<BusySlice> {
  return (state) => ({ pendingCount: Math.max(0, state.pendingCount - 1) });
}
