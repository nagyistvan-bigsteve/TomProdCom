import { describe, it, expect } from 'vitest';
import { setBusy, setIdle } from './with-busy.updaters';
import { initialBusySlice } from './with-busy.slice';

describe('withBusy updaters', () => {
  it('stays busy until every overlapping call has finished', () => {
    let state = initialBusySlice;

    state = { ...state, ...setBusy()(state) };
    state = { ...state, ...setBusy()(state) };
    state = { ...state, ...setIdle()(state) };
    expect(state.pendingCount).toBe(1);

    state = { ...state, ...setIdle()(state) };
    expect(state.pendingCount).toBe(0);
  });

  it('never goes below zero on an unmatched setIdle', () => {
    expect(setIdle()(initialBusySlice)).toEqual({ pendingCount: 0 });
  });
});
