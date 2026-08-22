import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferredPrompt: any = null;
  public installPromptAvailable = new BehaviorSubject<boolean>(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.installPromptAvailable.next(true);
    });

    window.addEventListener('appinstalled', () => {
      this.installPromptAvailable.next(false);
      console.log('App was installed');
    });
  }

  promptInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((result: any) => {
        if (result.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        this.deferredPrompt = null;
        this.installPromptAvailable.next(false);
      });
    }
  }
}
