/** A failed request to the Supabase data API. */
export interface ApiFailure {
  /** HTTP status, or `null` when the request never got a response (offline). */
  status: number | null;
  /** Postgres / PostgREST error code from the response body, if any. */
  code: string | null;
  method: string;
}

const NO_PERMISSION = '42501';
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Error codes raised by the stock functions in
 * supabase/migrations/*_graded_stock.sql, with their translation keys.
 */
const STOCK_ERROR_KEYS: Record<string, string> = {
  SA001: 'SNACKBAR.API.NOT_ENOUGH_AB',
  SA002: 'SNACKBAR.API.NOT_GRADABLE',
  SA003: 'SNACKBAR.API.SHIPMENT_LOCKED',
  SA004: 'SNACKBAR.API.SORTING_SOLD',
  SA005: 'SNACKBAR.API.MORE_THAN_TRUCK',
  SA006: 'SNACKBAR.API.STOCK_CHANGED',
  SA007: 'SNACKBAR.API.DRAFT_CHANGED',
  SA008: 'SNACKBAR.API.WHOLE_PIECES',
};

/** Accepts an `ApiFailure` or the error object a Supabase call returned. */
export function isPermissionFailure(failure: unknown): boolean {
  if (typeof failure !== 'object' || failure === null) return false;

  const { status, code } = failure as { status?: unknown; code?: unknown };

  return code === NO_PERMISSION || status === 401 || status === 403;
}

/**
 * True when the central toast already says exactly what went wrong (no
 * permission, duplicate, still in use, no connection). A call site should
 * then skip its own, more general message so it does not replace that one.
 */
export function hasSpecificApiMessage(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const { code } = error as { code?: unknown };

  return (
    isPermissionFailure(error) ||
    code === UNIQUE_VIOLATION ||
    code === FOREIGN_KEY_VIOLATION ||
    (typeof code === 'string' && code in STOCK_ERROR_KEYS) ||
    // supabase-js reports a request that never reached the server with an empty code
    code === ''
  );
}

/** Translation key of the message shown to the user for a failed request. */
export function apiErrorKey(failure: ApiFailure): string {
  if (failure.status === null) return 'SNACKBAR.API.NETWORK';
  if (isPermissionFailure(failure)) return 'SNACKBAR.API.NO_PERMISSION';
  if (failure.code === UNIQUE_VIOLATION) return 'SNACKBAR.API.DUPLICATE';
  if (failure.code === FOREIGN_KEY_VIOLATION) return 'SNACKBAR.API.IN_USE';
  if (failure.code && failure.code in STOCK_ERROR_KEYS) return STOCK_ERROR_KEYS[failure.code];

  return ['GET', 'HEAD'].includes(failure.method.toUpperCase())
    ? 'SNACKBAR.GENERAL.LOAD_ERROR'
    : 'SNACKBAR.GENERAL.SAVE_ERROR';
}
