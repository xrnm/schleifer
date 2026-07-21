import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase.client';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';
type AuthResult = { error: AuthError | null };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly status = signal<AuthStatus>('loading');
  readonly userId = computed(() => this.user()?.id ?? null);
  readonly email = computed(() => this.user()?.email ?? null);
  /** True while the user is in the password-reset landing flow. */
  readonly recovery = signal(false);

  private initialized = false;

  /** Called once at bootstrap (APP_INITIALIZER). Hydrates + subscribes. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Did the app open from an auth email link (confirm / reset / magic)? Those
    // land on the app origin with a PKCE `code` (or an implicit token in the
    // hash). When they do, route to the account page after sign-in so the user
    // lands on their account, not the drill home. A normal in-app login or a
    // restored session (INITIAL_SESSION) carries no such param and is left where
    // it is.
    const loc = window.location;
    let cameFromAuthLink =
      /[?&]code=/.test(loc.search) ||
      /(access_token=|type=(recovery|signup|magiclink|invite|email_change))/.test(
        loc.hash + loc.search,
      );

    supabase.auth.getSession().then(({ data }) => this.apply(data.session));

    supabase.auth.onAuthStateChange((event, session) => {
      this.apply(session);
      if (event === 'PASSWORD_RECOVERY') {
        // Arrived from a reset email; surface the set-new-password form.
        this.recovery.set(true);
        cameFromAuthLink = false;
        void this.router.navigate(['/account']);
      } else if (event === 'SIGNED_IN' && cameFromAuthLink) {
        cameFromAuthLink = false;
        void this.router.navigate(['/account']);
      }
    });
  }

  private apply(session: Session | null): void {
    this.user.set(session?.user ?? null);
    this.status.set(session?.user ? 'signedIn' : 'signedOut');
  }

  // Email links land back on the app origin; PKCE puts `?code=` in the query,
  // which supabase-js (detectSessionInUrl) consumes on load.
  private redirectTo(): string {
    return window.location.origin + '/';
  }

  signUp(email: string, password: string): Promise<AuthResult> {
    return supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: this.redirectTo() },
    });
  }

  signIn(email: string, password: string): Promise<AuthResult> {
    return supabase.auth.signInWithPassword({ email, password });
  }

  signOut(): Promise<AuthResult> {
    return supabase.auth.signOut();
  }

  resetPassword(email: string): Promise<AuthResult> {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: this.redirectTo(),
    });
  }

  async updatePassword(password: string): Promise<AuthResult> {
    const res = await supabase.auth.updateUser({ password });
    if (!res.error) this.recovery.set(false);
    return res;
  }
}
