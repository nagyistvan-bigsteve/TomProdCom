/**
 * supabase-js resolves with `{ data, error }` instead of rejecting, so a failed
 * query looks like an empty result unless `error` is checked.
 *
 * Returns `data` and throws `error`, so failures reach the caller's error path.
 */
export function unwrapResult<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}
