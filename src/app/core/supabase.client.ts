import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// Single shared client so AuthService and SyncService don't each spin one up.
// - persistSession/autoRefreshToken: keep the user signed in across reloads
//   (stored in localStorage under an `sb-<ref>-auth-token` key).
// - detectSessionInUrl + pkce: needed for the email confirm / password-reset
//   redirect landing to establish a session from the callback URL.
export const supabase: SupabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);
