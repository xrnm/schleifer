# Changelog

All notable changes to Schleifer are tracked here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/),
dates in `YYYY-MM-DD`.

## 2026-05-11

- Top-level practice areas. The header nav now offers two modes —
  **Deklination** (the original case-drill quiz) and **Vokabular** (a new
  multiple-choice translation drill). Each has its own home screen, its own
  Sitzung-starten / Drill-due-now flow, and its own SRS queue; translation
  cards live alongside declension cards in the same `cardStates` store
  under `${nounId}|translation` ids so they never collide. `/` redirects to
  `/deklination`; vocab sessions live under `/vokabular/session/:id`.
- Deklination filters drawer. A gear-icon button sits next to "Sitzung
  starten" on the Deklination home and toggles a drawer with three
  segmented-pill rows — Fall `[Alle|Nom|Akk|Dat]`, Numerus `[Beide|Sg|Pl]`,
  Artikel `[Beide|Bestimmt|Unbestimmt]` — so you can narrow a session to a
  specific case, number, or article type. Selections persist in
  `localStorage` (`schleifer.settings`) and the "due now" count refreshes
  immediately when filters change. The home page's standalone
  "Daten / Export" button was retired (Data is still in the top nav).
- Vokabular session UI. Four large choice buttons under a centered prompt,
  random DE→EN or EN→DE direction per question, keyboard shortcuts `1–4`
  or `A–D` to pick and `Enter` to advance. Same SRS engine as Deklination
  — correct answers extend the interval, misses reset it.

## 2026-05-10

- Article-system mismatch detection extended: the soft retry now also fires
  on plural cards when the user typed an indef-singular article paired with
  the right plural-noun form (e.g. `Einen Seminaren` for an expected
  `den Seminaren`). The noun side now forgives a single typo, so a stray
  capital like `Der KRise` no longer cancels detection. Umlaut errors and
  trailing insert/delete (missing dative-pl `-n`, etc.) still count as
  grammar misses, not slips.

## 2026-05-09

- Phone-size pass: tighter type scale at ≤640 and ≤420, reduced page
  padding, brand sub hidden, nav allowed to wrap, quiz card noun and
  chips slimmed down, kbd hint hidden on touch widths, review summary
  reflows to 2 cols then 1, data page's 5-up stat strip switched to
  horizontal scroll instead of crushing. Added iOS safe-area padding
  and a 44 px minimum touch target on touch devices.
- Installable PWA: `manifest.webmanifest` (standalone, dark theme,
  128/256/512 icons + maskable) and a small custom service worker
  (`public/sw.js`) that pre-caches the app shell, network-first for
  navigations so deploys propagate, cache-first for same-origin assets.
  Registered in `main.ts` with a localhost guard so `ng serve` stays
  uncached. iOS web-app meta tags + theme-color land in `index.html`.
- Wired Google Analytics (`G-L6W84ZWCTP`) via gtag.js in `index.html`.
- Initial commit and launch — first public deployment at
  <https://schleifer.justinedwards.me>.
- Bumped the project's Node version pin from 20 to 24 — current Active
  LTS — in `.nvmrc` and `engines.node`. (Originally landed targeting 26,
  walked back the same day because the Cloudflare Pages build image
  doesn't ship 26 yet.)
- Added a footer with links to <https://justinedwards.me>, the GitHub
  source, and Claude.
- Quiz card: special-character drawer (`ä Ä ö Ö ü Ü ß`) that inserts at
  the caret position so users without a German keyboard can answer
  without juggling input methods.
- Quiz feedback: the English translation moved to the bottom of the card
  with a clear `Translation:` / `Übersetzung:` label and ~15% larger
  type, so the meaning is visible at a glance.
- Article-system mismatch warning: typing the definite form when a card
  asked for indefinite (or vice versa) no longer fails the answer.
  The card shakes, an inline notice explains which article was used and
  which the card wanted, and the input stays editable so the user can
  fix and resubmit. Plurals are exempt (German has no indefinite plural).
- Wired the Esc key to skip the active card while answering.
