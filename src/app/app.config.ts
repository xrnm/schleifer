import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { CatalogService } from './core/catalog.service';

function initCatalog(catalog: CatalogService) {
  return () => catalog.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initCatalog,
      deps: [CatalogService],
      multi: true,
    },
  ],
};
