// Vitest setup file (angular.json → test.options.setupFiles). The unit-test
// builder initialises the Angular test environment; this file gives every
// spec the app-wide providers that standalone components expect from
// app.config.ts, so a spec only has to configure what is specific to its
// component.
import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { createClient } from '@supabase/supabase-js';
import { NEVER } from 'rxjs';
import { SupabaseService } from '@core/services/supabase.service';

/**
 * Specs never reach a real Supabase project. Every request gets an empty,
 * successful answer (an empty list, or an empty object from auth), so
 * components load as if the database had no rows. A spec that needs data or
 * an error provides its own SupabaseService.
 */
const offlineFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const body = url.includes('/auth/v1/') ? {} : [];
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const testSupabaseService = {
  apiFailures$: NEVER,
  client: createClient('http://supabase.test', 'test-anon-key', {
    global: { fetch: offlineFetch },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // No Navigator LockManager: specs run many app instances in one page
      lock: (_name, _timeout, fn) => fn(),
    },
  }),
} as unknown as SupabaseService;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      importProvidersFrom(TranslateModule.forRoot()),
      provideRouter([]),
      provideNoopAnimations(),
      provideHttpClient(withXhr()),
      provideHttpClientTesting(),
      // Dialog components are created directly in their specs, not opened
      { provide: MatDialogRef, useValue: { close: () => {} } },
      { provide: MAT_DIALOG_DATA, useValue: {} },
      { provide: SupabaseService, useValue: testSupabaseService },
    ],
  });
});
