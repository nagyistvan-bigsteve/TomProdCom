import { inject, Injectable } from '@angular/core';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export interface Profile {
  role: 'user' | 'admin';
  approved: boolean;
  email: string;
  name: string | null;
}

/**
 * Sign-up, sign-in and the signed-in user's own profile. Every method throws
 * the Supabase error on failure.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  async signUp(email: string, password: string, name: string): Promise<AuthUser | null> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    return data.user;
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.user;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('role, approved, email, name')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data as Profile;
  }
}
