import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiFailure } from './api-error.util';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private apiFailures = new Subject<ApiFailure>();

  /**
   * Every failed request to the data API (tables and database functions).
   * The app shell turns these into a translated toast, so no call site can
   * fail silently. Auth requests are not included; the auth pages show their
   * own messages.
   */
  readonly apiFailures$: Observable<ApiFailure> =
    this.apiFailures.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      { global: { fetch: this.reportingFetch } },
    );
  }

  get client() {
    return this.supabase;
  }

  private reportingFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const isDataRequest = url.includes('/rest/v1/');
    const method = init?.method ?? 'GET';

    try {
      const response = await fetch(input, init);

      if (isDataRequest && !response.ok) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);

        this.apiFailures.next({
          status: response.status,
          code: typeof body?.code === 'string' ? body.code : null,
          method,
        });
      }

      return response;
    } catch (error) {
      if (isDataRequest && (error as Error)?.name !== 'AbortError') {
        this.apiFailures.next({ status: null, code: null, method });
      }

      throw error;
    }
  };
}
