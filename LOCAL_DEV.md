# Local development — accounts & cloud sync

Schleifer works fully **without** an account (anonymous, offline, IndexedDB). The
account + cloud-sync layer talks to Supabase. For local development you run a
Supabase stack on your machine so you can exercise sign-up and sync **without
touching the production project and without needing a real email** (email
confirmation is turned off locally, so sign-up signs you straight in).

## Prerequisites

- Docker running
- The [Supabase CLI](https://supabase.com/docs/guides/cli) on your `PATH`
  (`supabase --version`)

## Run it

```bash
supabase start          # boots local Postgres + Auth + PostgREST (first run pulls images)
npm run start:local     # ng serve pointed at the local stack (http://localhost:4200)
```

`supabase start` applies `supabase/migrations/*.sql` (the same schema + RLS +
grants as production) and prints the local URLs. Useful ones:

- App: <http://localhost:4200>
- Supabase Studio (inspect tables): <http://localhost:54323>
- API: <http://127.0.0.1:54321>

`npm run start:local` uses the `local` Angular configuration, which swaps
`src/environments/environment.ts` for `src/environments/environment.local.ts`
(local URL + Supabase's fixed local demo anon key — not a secret).

## Try the sync flow

1. Open <http://localhost:4200>, go to **Account**, create an account — with
   email confirmation off you're signed in immediately.
2. Add a noun on **My Nouns** and/or drill a card on **Declension**.
3. On **Account**, hit **Sync now** (sync also runs automatically in the
   background on login / resume / every 30s).
4. Open a second **incognito window** (separate storage = a second "device"),
   sign in with the same account, and watch your custom noun + progress arrive.
5. Inspect the rows in Studio → Table editor (`card_states`, `sessions`,
   `events`, `custom_nouns`).

## Stop it

```bash
supabase stop           # add --no-backup to also drop local data
```

## Notes

- `realtime` and `analytics` are disabled in `supabase/config.toml` — they're
  not needed here and their images pull from Docker Hub (subject to anonymous
  rate limits). Everything else runs from cached images. Re-enable them if you
  want; run `docker login` first if you hit `toomanyrequests`.
- The production project is configured in `environment.ts` /
  `environment.prod.ts`; `npm start` / `npm run build` use those. Only
  `start:local` / `ng build --configuration local` use the local stack.
- Schema changes: add a new file under `supabase/migrations/` and re-run
  `supabase start` (or `supabase db reset`). Keep it in sync with production.
