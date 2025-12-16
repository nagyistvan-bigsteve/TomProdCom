import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

declare global {
  interface Window {
    __APP_VERSION__: string;
  }
}

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
