import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

// Register the service worker only in production-like origins. Skip on
// localhost so `ng serve` never serves a stale cached shell during dev.
if ('serviceWorker' in navigator) {
  const host = location.hostname;
  const isDev = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (!isDev) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
