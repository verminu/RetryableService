import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { HttpRetryService } from "./http-retry-service/http-retry.service";
import { provideHttpClient } from "@angular/common/http";
import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    HttpRetryService,
    provideAnimations()
]
};
