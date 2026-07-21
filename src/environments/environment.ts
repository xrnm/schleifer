// Base (development) environment. The Supabase publishable/anon key is safe to
// ship in the client bundle — access is enforced by row-level security. The
// real secret (service_role) never leaves Supabase.
export const environment = {
  production: false,
  supabaseUrl: 'https://iinpewnkavhrxgqdxoue.supabase.co',
  supabaseAnonKey: 'sb_publishable_25uHvQxxSTYcuzepqt1mXg_hJm6TBy6',
};
