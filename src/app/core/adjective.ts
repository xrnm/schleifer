import {
  AdjClass,
  AdjectiveEntry,
  CaseT,
  Gender,
  Noun,
  NumberT,
} from '../models/types';
import {
  articleFor,
  dativePlural,
  diffInvolvesUmlaut,
  isTrailingInsertOrDelete,
  levenshtein,
  possessiveForm,
} from './declension';

// A single drillable ending cell — the unit the SRS schedules. Singular cells
// are per (class × gender × case); plural cells collapse gender, so they are
// per (class × case). 3 classes × (3×3 sg + 3 pl) = 36 cells total.
export interface AdjCell {
  cls: AdjClass;
  number: NumberT;
  case: CaseT;
  gender?: Gender; // present iff number === 'sg'
}

const CLASSES: AdjClass[] = ['weak', 'mixed', 'strong'];
const CASES: CaseT[] = ['nom', 'acc', 'dat'];
const GENDERS: Gender[] = ['m', 'f', 'n'];

// The adjective-ending table for nom/acc/dat. Singular endings are indexed by
// gender; plural endings are gender-independent.
const ADJ_END: Record<
  AdjClass,
  {
    sg: Record<CaseT, Record<Gender, string>>;
    pl: Record<CaseT, string>;
  }
> = {
  weak: {
    sg: {
      nom: { m: 'e', f: 'e', n: 'e' },
      acc: { m: 'en', f: 'e', n: 'e' },
      dat: { m: 'en', f: 'en', n: 'en' },
    },
    pl: { nom: 'en', acc: 'en', dat: 'en' },
  },
  mixed: {
    sg: {
      nom: { m: 'er', f: 'e', n: 'es' },
      acc: { m: 'en', f: 'e', n: 'es' },
      dat: { m: 'en', f: 'en', n: 'en' },
    },
    pl: { nom: 'en', acc: 'en', dat: 'en' },
  },
  strong: {
    sg: {
      nom: { m: 'er', f: 'e', n: 'es' },
      acc: { m: 'en', f: 'e', n: 'es' },
      dat: { m: 'em', f: 'er', n: 'em' },
    },
    pl: { nom: 'e', acc: 'e', dat: 'en' },
  },
};

export function adjectiveEnding(cell: AdjCell): string {
  if (cell.number === 'pl') return ADJ_END[cell.cls].pl[cell.case];
  return ADJ_END[cell.cls].sg[cell.case][cell.gender!];
}

/**
 * The inflected attributive adjective for a cell, e.g. gut → "guten", hoch →
 * "hohen", teuer → "teurem". Endings attach to `stem` when present (the el/er
 * contraction and hoch→hoh), otherwise to `base`.
 */
export function declineAdjective(adj: AdjectiveEntry, cell: AdjCell): string {
  return (adj.stem ?? adj.base) + adjectiveEnding(cell);
}

/**
 * The determiner that carries the cell's class:
 *   weak   → definite article (der/die/das…)
 *   mixed  → ein in the singular, the possessive `mein` in the plural (since
 *            `ein` has no plural). Both decline as ein-words.
 *   strong → none.
 */
export function adjDeterminer(cell: AdjCell, gender: Gender): string {
  if (cell.cls === 'strong') return '';
  if (cell.cls === 'weak') return articleFor(gender, cell.number, cell.case, 'def');
  if (cell.number === 'sg') return articleFor(gender, 'sg', cell.case, 'indef');
  return possessiveForm('mein', gender, 'pl', cell.case);
}

function nounSurface(noun: Noun, number: NumberT, caseT: CaseT): string {
  if (number === 'sg') return noun.singular;
  const pl = noun.plural ?? noun.singular;
  return caseT === 'dat' ? dativePlural(pl) : pl;
}

/** The full expected phrase, e.g. "dem guten Wein", "kaltem Wasser". */
export function expectedAdjPhrase(
  adj: AdjectiveEntry,
  noun: Noun,
  cell: AdjCell,
): string {
  const det = adjDeterminer(cell, noun.gender);
  const a = declineAdjective(adj, cell);
  const n = nounSurface(noun, cell.number, cell.case);
  return det ? `${det} ${a} ${n}` : `${a} ${n}`;
}

/**
 * The whole phrase in English, composed for the feedback panel:
 * "a beautiful window", "the good wine", "cold water", "my good wines".
 * Article word follows the class; the noun gloss is the first sense of the
 * corpus english. Matches the app convention that the shown translation is
 * always English (the corpus carries only english glosses).
 */
export function adjPhraseGlossEn(
  adj: AdjectiveEntry,
  noun: Noun,
  cell: AdjCell,
): string {
  let article = '';
  if (cell.cls === 'weak') article = 'the ';
  else if (cell.cls === 'mixed') {
    article =
      cell.number === 'pl' ? 'my ' : /^[aeiou]/i.test(adj.en) ? 'an ' : 'a ';
  }
  const nounGloss = noun.english.split(';')[0].split(',')[0].trim();
  const plural = cell.number === 'pl' ? pluralizeEn(nounGloss) : nounGloss;
  return `${article}${adj.en} ${plural}`;
}

// Common irregular English plurals, so a gloss reads "men" not "mans".
const IRREGULAR_PLURALS_EN: Record<string, string> = {
  man: 'men',
  woman: 'women',
  child: 'children',
  person: 'people',
  foot: 'feet',
  tooth: 'teeth',
  mouse: 'mice',
  goose: 'geese',
  fish: 'fish',
  sheep: 'sheep',
  deer: 'deer',
  ox: 'oxen',
};

// Rough English pluralization — good enough for a gloss hint, not grammar.
function pluralizeEn(word: string): string {
  const irr = IRREGULAR_PLURALS_EN[word.toLowerCase()];
  if (irr) return irr;
  if (/[sxz]$/.test(word) || /(ch|sh)$/.test(word)) return word + 'es';
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

// --- Card-id scheme ------------------------------------------------------
// Adjective cards live in the shared cardStates store alongside declension
// (`noun|…`) and translation (`…|translation`) cards. The `adj|` prefix keeps
// them distinct and greppable. Singular: `adj|<cls>|sg|<case>|<gender>`,
// plural: `adj|<cls>|pl|<case>`.

const ADJ_PREFIX = 'adj|';

export function isAdjectiveCardId(id: string): boolean {
  return id.startsWith(ADJ_PREFIX);
}

export function adjCellId(cell: AdjCell): string {
  return cell.number === 'sg'
    ? `${ADJ_PREFIX}${cell.cls}|sg|${cell.case}|${cell.gender}`
    : `${ADJ_PREFIX}${cell.cls}|pl|${cell.case}`;
}

export function parseAdjCellId(id: string): AdjCell | null {
  if (!isAdjectiveCardId(id)) return null;
  const p = id.split('|'); // ['adj', cls, number, case, gender?]
  const cls = p[1] as AdjClass;
  const number = p[2] as NumberT;
  const caseT = p[3] as CaseT;
  if (!CLASSES.includes(cls)) return null;
  if (!CASES.includes(caseT)) return null;
  if (number === 'sg') {
    const gender = p[4] as Gender;
    if (!GENDERS.includes(gender)) return null;
    return { cls, number: 'sg', case: caseT, gender };
  }
  if (number === 'pl') return { cls, number: 'pl', case: caseT };
  return null;
}

/** All 36 ending cells. */
export function allAdjCells(): AdjCell[] {
  const cells: AdjCell[] = [];
  for (const cls of CLASSES) {
    for (const c of CASES) {
      for (const g of GENDERS) cells.push({ cls, number: 'sg', case: c, gender: g });
      cells.push({ cls, number: 'pl', case: c });
    }
  }
  return cells;
}

// --- Surface selection ---------------------------------------------------

export interface AdjSurface {
  adj: AdjectiveEntry;
  noun: Noun;
}

/**
 * Pick a plausible (adjective, noun) pair to render a cell. Nouns are filtered
 * to those that can carry the cell — matching gender in the singular, having a
 * plural in the plural. Irregular-stem adjectives are weighted up so their
 * quirks (hoh-, teur-, dunkl-) keep surfacing.
 */
export function pickAdjSurface(
  cell: AdjCell,
  adjectives: AdjectiveEntry[],
  nounById: Map<string, Noun>,
  rand: () => number = Math.random,
): AdjSurface | null {
  const compatible = (adj: AdjectiveEntry): Noun[] =>
    adj.nounIds
      .map((id) => nounById.get(id))
      .filter((n): n is Noun => {
        if (!n) return false;
        if (cell.number === 'pl') return n.plural !== null;
        return !n.pluralOnly && n.gender === cell.gender;
      });

  const pool = adjectives
    .map((adj) => ({ adj, nouns: compatible(adj), weight: adj.stem ? 2 : 1 }))
    .filter((x) => x.nouns.length > 0);
  if (pool.length === 0) return null;

  const total = pool.reduce((acc, x) => acc + x.weight, 0);
  let r = rand() * total;
  let chosen = pool[0];
  for (const x of pool) {
    r -= x.weight;
    if (r <= 0) {
      chosen = x;
      break;
    }
  }
  const noun = chosen.nouns[Math.floor(rand() * chosen.nouns.length)];
  return { adj: chosen.adj, noun };
}

// --- Answer checking -----------------------------------------------------
// Mirrors declension's split: the determiner and the adjective ending are
// grammar and must be exact (first-letter casing on the phrase is free); the
// noun keeps the one-typo forgiveness, with umlauts strict and a trailing
// insert/delete treated as a grammar slip, not a finger slip.

export type AdjCheck =
  | { kind: 'exact' }
  // Correct apart from capitalization — accepted, but flagged so the learner
  // notices (German capitalizes nouns; adjectives/articles stay lowercase).
  | { kind: 'caps' }
  | { kind: 'typo'; distance: 1 }
  | { kind: 'wrong' };

export function checkAdjAnswer(entered: string, expected: string): AdjCheck {
  const e = entered.trim().replace(/\s+/g, ' ');
  if (e === expected) return { kind: 'exact' };

  // A capital first letter is a natural way to start typing — accept it
  // silently (as exact, not even a caps flag) when it's the only difference.
  if (foldFirst(e) === foldFirst(expected)) return { kind: 'exact' };

  const eSplit = splitHeadNoun(e);
  const xSplit = splitHeadNoun(expected);

  // The determiner + adjective (everything up to the noun) is grammar, but
  // capitalization is never graded — a learner shouldn't be dinged for an
  // over-eager capital ("Die Saubere Straße"). Compare case-insensitively; a
  // real article or ending difference still fails.
  if (eSplit.head.toLowerCase() !== xSplit.head.toLowerCase()) return { kind: 'wrong' };

  // The noun likewise ignores case (its capital is a given), but stays strict
  // on umlauts/ß and treats a trailing insert/delete as a grammar slip.
  const en = eSplit.noun.toLowerCase();
  const xn = xSplit.noun.toLowerCase();
  if (en !== xn) {
    if (levenshtein(en, xn, 2) !== 1) return { kind: 'wrong' };
    if (diffInvolvesUmlaut(en, xn)) return { kind: 'wrong' };
    if (isTrailingInsertOrDelete(en, xn)) return { kind: 'wrong' };
    return { kind: 'typo', distance: 1 };
  }
  // Case-insensitively identical but not byte-identical (and whitespace was
  // already normalized): the only difference is capitalization.
  return { kind: 'caps' };
}

// Lowercase only the first character, so two strings that differ solely in the
// case of their leading letter compare equal.
function foldFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

const ALL_CLASSES: AdjClass[] = ['weak', 'mixed', 'strong'];

/**
 * When an answer is wrong for this card but is the correct phrase for a
 * DIFFERENT declension class (same adjective/noun/case/number), returns that
 * other class — the learner used the right ending for the wrong type (e.g. the
 * schwach form on a stark card). Used to shake-and-reprompt instead of marking
 * it wrong outright. Capitalization is forgiven; a typo is not a confident
 * mismatch. Determiners differ per class, so no class collides with the
 * current one.
 */
export function detectAdjClassMismatch(
  entered: string,
  adj: AdjectiveEntry,
  noun: Noun,
  cell: AdjCell,
): AdjClass | null {
  for (const other of ALL_CLASSES) {
    if (other === cell.cls) continue;
    const otherExpected = expectedAdjPhrase(adj, noun, { ...cell, cls: other });
    const r = checkAdjAnswer(entered, otherExpected);
    if (r.kind === 'exact' || r.kind === 'caps') return other;
  }
  return null;
}

// Split a phrase into its last whitespace-delimited token (the noun) and the
// rest (article + adjective). A single-token phrase has an empty head.
function splitHeadNoun(s: string): { head: string; noun: string } {
  const i = s.lastIndexOf(' ');
  if (i < 0) return { head: '', noun: s };
  return { head: s.slice(0, i), noun: s.slice(i + 1) };
}
