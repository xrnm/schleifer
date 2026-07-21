// Local development against a `supabase start` stack. Swapped in for
// environment.ts by the angular.json `local` configuration
// (`npm run start:local`). These are Supabase's fixed local demo keys — not
// secrets, safe to commit. Email confirmation is off locally (see
// supabase/config.toml) so sign-up signs you straight in.
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
};
