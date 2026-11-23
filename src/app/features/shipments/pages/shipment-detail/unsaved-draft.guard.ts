import { CanDeactivateFn } from '@angular/router';

/** A page that may hold unsaved input and asks before it is left. */
export interface ConfirmsLeave {
  confirmLeave(): Promise<boolean>;
}

/** Asks before leaving a truck draft with unsaved changes (back button, menu, Cancel). */
export const unsavedDraftGuard: CanDeactivateFn<ConfirmsLeave> = (component) =>
  component?.confirmLeave ? component.confirmLeave() : true;
