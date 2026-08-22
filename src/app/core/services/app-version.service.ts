import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private readonly STORAGE_KEY = 'app_version';

  checkAndReloadIfNeeded(): void {
    const current = window.__APP_VERSION__;
    const stored = localStorage.getItem(this.STORAGE_KEY);

    if (!stored) {
      localStorage.setItem(this.STORAGE_KEY, current);
      return;
    }

    if (stored !== current) {
      localStorage.setItem(this.STORAGE_KEY, current);

      location.reload();
    }
  }
}
