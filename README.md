# Schleifer

**Live at <https://schleifer.justinedwards.me>**

A daily drill app for German noun cases. Type the article + adjective + noun
form for a randomly chosen noun, case, number, and definiteness; get
immediate feedback with a relevant gender rule. Spaced-repetition state and
session history live in the browser via IndexedDB — there is no backend.

The visual direction is **Schliff** (German for *cut / grind / polish*):
ink-black canvas, sparing signal-orange, Inter + JetBrains Mono, square
corners, hairline rules, and `der` / `die` / `das` as colored brand tokens.

## Features

- Drill sessions of arbitrary length with the four cases
  (Nominativ, Akkusativ, Dativ — Genitiv reserved for future use), both
  numbers (Singular / Plural), and definite + indefinite article forms.
- Typo tolerance: Levenshtein ≤ 2 with a matching first letter is accepted
  but flagged.
- Article-system mismatch warning: typing the definite form when a card
  asked for the indefinite (or vice versa) shakes the card, surfaces an
  inline explanation, and leaves the answer editable for correction
  rather than marking it wrong outright.
- Special-character drawer (`ä Ä ö Ö ü Ü ß`) on the quiz card that
  inserts at the caret for users without a German keyboard.
- Per-card SRS state (reps, lapses, next-due timestamp) drives a
  "drill due now" path on the home screen.
- Session review with breakdown of correct, missed, unknown, and skipped
  cards — and a "drill the misses" follow-up session.
- Rules reference covering the four cases, articles, adjective endings,
  plural heuristics, and gender heuristics.
- Corpus / Data page with import + export of all local user data
  (sessions, card states, events) as JSON, plus a wipe action.
- English / German UI toggle.
- Installable as a PWA — phone-optimised layout, offline app shell,
  standalone display, dark theme.

## Stack

- Angular 19 (standalone components, zoneless-friendly).
- IndexedDB via [`idb`](https://www.npmjs.com/package/idb).
- Inter + JetBrains Mono web fonts.

## Running locally

```bash
npm install
npm start          # ng serve on http://localhost:4200
npm run build      # production bundle into dist/
npm test           # karma + jasmine
```

The noun catalog and reference tables ship as committed JSON in
`src/assets/` — there is no asset prebuild step. Edit the JSON directly to
amend rules or vocabulary.

## Project layout

```
src/
  app/
    core/        services: catalog, db, srs, declension, i18n, etc.
    pages/       routed pages: home, session, progress, rules, data
    models/      shared types
  assets/        nouns.json, case-tables.json (source of truth)
  styles.css     Schliff design tokens + component styles
public/          favicons + logo PNGs
scripts/         puppeteer-based verify-* smoke checks
```

## License

[MIT](LICENSE).
