/**
 * Picks the name shown in the UI for the logged-in user.
 * `profiles.name` is the source of truth; Auth metadata and email are display fallbacks only.
 */
export function resolveDisplayName(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
