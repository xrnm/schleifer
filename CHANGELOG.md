# Changelog

All notable changes to Schleifer are tracked here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/),
dates in `YYYY-MM-DD`.

## 2026-05-09

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
