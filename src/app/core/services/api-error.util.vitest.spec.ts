import { describe, it, expect } from 'vitest';
import {
  apiErrorKey,
  hasSpecificApiMessage,
  isPermissionFailure,
} from './api-error.util';

describe('apiErrorKey', () => {
  it('reports a missing connection when there was no response', () => {
    expect(apiErrorKey({ status: null, code: null, method: 'POST' })).toBe(
      'SNACKBAR.API.NETWORK',
    );
  });

  it('reports missing rights for a Postgres permission error', () => {
    // e.g. a demoted admin calling set_user_role
    expect(apiErrorKey({ status: 403, code: '42501', method: 'POST' })).toBe(
      'SNACKBAR.API.NO_PERMISSION',
    );
  });

  it('reports missing rights for 401 / 403 without an error code', () => {
    expect(apiErrorKey({ status: 401, code: null, method: 'GET' })).toBe(
      'SNACKBAR.API.NO_PERMISSION',
    );
    expect(apiErrorKey({ status: 403, code: null, method: 'PATCH' })).toBe(
      'SNACKBAR.API.NO_PERMISSION',
    );
  });

  it('reports duplicates and rows that are still referenced', () => {
    expect(apiErrorKey({ status: 409, code: '23505', method: 'POST' })).toBe(
      'SNACKBAR.API.DUPLICATE',
    );
    expect(apiErrorKey({ status: 409, code: '23503', method: 'DELETE' })).toBe(
      'SNACKBAR.API.IN_USE',
    );
  });

  it('falls back to a load error for reads and a save error for writes', () => {
    expect(apiErrorKey({ status: 500, code: null, method: 'get' })).toBe(
      'SNACKBAR.GENERAL.LOAD_ERROR',
    );
    expect(apiErrorKey({ status: 500, code: null, method: 'HEAD' })).toBe(
      'SNACKBAR.GENERAL.LOAD_ERROR',
    );
    expect(apiErrorKey({ status: 400, code: 'P0002', method: 'POST' })).toBe(
      'SNACKBAR.GENERAL.SAVE_ERROR',
    );
  });
});

describe('hasSpecificApiMessage', () => {
  it('is true for errors the central toast names precisely', () => {
    expect(hasSpecificApiMessage({ code: '42501' })).toBe(true);
    expect(hasSpecificApiMessage({ code: '23505' })).toBe(true);
    expect(hasSpecificApiMessage({ code: '23503' })).toBe(true);
    // request never reached the server
    expect(hasSpecificApiMessage({ code: '', message: 'Failed to fetch' })).toBe(
      true,
    );
  });

  it('is false for errors that only get the general load/save message', () => {
    expect(hasSpecificApiMessage({ code: 'PGRST116' })).toBe(false);
    expect(hasSpecificApiMessage({ code: 'P0002' })).toBe(false);
    expect(hasSpecificApiMessage(undefined)).toBe(false);
  });
});

describe('isPermissionFailure', () => {
  it('recognises a Supabase error object by its code', () => {
    expect(isPermissionFailure({ code: '42501' })).toBe(true);
    expect(isPermissionFailure({ code: '23505' })).toBe(false);
    expect(isPermissionFailure({})).toBe(false);
    expect(isPermissionFailure(null)).toBe(false);
    expect(isPermissionFailure('boom')).toBe(false);
  });
});
