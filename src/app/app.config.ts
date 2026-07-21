import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { CatalogService } from './core/catalog.service';
import { SyncService } from './core/sync.service';

function initApp(
  catalog: CatalogService,
  auth: AuthService,
  sync: SyncService,
) {
  return () => {
    // Ask the browser to keep our IndexedDB (all progress lives there) out of
    // eviction-under-pressure. Fire-and-forget; granted based on engagement /
    // PWA-installed. This protects anonymous users too.
    navigator.storage?.persist?.().catch(() => {});
    // Auth bootstrap is fire-and-forget; the app must not block on the network
    // and stays fully usable signed-out. Injecting SyncService (via deps)
    // constructs it, which registers the effect that reacts to auth state.
    auth.init();
    void sync;
    return catalog.init();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initApp,
      deps: [CatalogService, AuthService, SyncService],
      multi: true,
    },
  ],
};
