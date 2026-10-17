import { inject, Injectable } from '@angular/core';
import { User } from '@core/models/models';
import { SupabaseService } from './supabase.service';

/** User administration (admins only; RLS enforces it). Methods throw on failure. */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly supabase = inject(SupabaseService).client;

  async getUsers(approved: boolean): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('approved', approved);
    if (error) throw error;
    return (data ?? []) as User[];
  }

  async approve(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ approved: true })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
  }

  /** Removes the profile of a user who was not approved. */
  async deny(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
  }

  /** Changes the role and the admin_users membership together. */
  async setRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    const { error } = await this.supabase.rpc('set_user_role', {
      p_user_id: userId,
      p_role: role,
    });
    if (error) throw error;
  }
}
