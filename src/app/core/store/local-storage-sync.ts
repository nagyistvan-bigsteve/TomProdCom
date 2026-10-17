import { effect } from '@angular/core';

/**
 * Keeps a localStorage key in step with store state. Call it from an
 * injection context (e.g. a store's `onInit` hook) after restoring the saved
 * value. Whenever the selected value changes it is written as JSON;
 * `null` removes the key; `undefined` leaves the key untouched (e.g. while
 * the user still has to decide about a saved value).
 */
export function syncToLocalStorage(key: string, select: () => unknown): void {
  effect(() => {
    const value = select();
    if (value === undefined) return;

    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      // Private mode or full storage: the app keeps working without it
      console.error(`Could not save "${key}" to localStorage`, error);
    }
  });
}

/** The parsed value of a localStorage key, or null if missing or unreadable. */
export function readFromLocalStorage<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch (error) {
    console.error(`Could not read "${key}" from localStorage`, error);
    return null;
  }
}
