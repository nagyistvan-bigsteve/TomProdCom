export interface CheckSessionResult {
  success: boolean;
  isAuthenticated: boolean;
}

/**
 * Cached auth state (localStorage) is only a startup hint.
 * It must be dropped when Supabase confirms there is no session, but kept when
 * the check itself failed (e.g. offline), so the PWA stays usable without network.
 */
export function shouldResetCachedAuth(result: CheckSessionResult): boolean {
  return result.success && !result.isAuthenticated;
}
