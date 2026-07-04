import {
  ArticleT,
  CaseT,
  Card,
  Gender,
  Noun,
  NumberT,
  PossessiveStem,
} from '../models/types';

const DEF_SG: Record<Gender, Record<CaseT, string>> = {
  m: { nom: 'der', acc: 'den', dat: 'dem' },
  f: { nom: 'die', acc: 'die', dat: 'der' },
  n: { nom: 'das', acc: 'das', dat: 'dem' },
};
const DEF_PL: Record<CaseT, string> = { nom: 'die', acc: 'die', dat: 'den' };
const INDEF_SG: Record<Gender, Record<CaseT, string>> = {
  m: { nom: 'ein', acc: 'einen', dat: 'einem' },
  f: { nom: 'eine', acc: 'eine', dat: 'einer' },
  n: { nom: 'ein', acc: 'ein', dat: 'einem' },
};

// Possessives ("Possessivartikel"/"ein-Wörter") decline like `ein`: empty
// ending in the masc/neut nominative and neut accusative, otherwise -e/-en/-em/-er.
// Plurals always take -e/-en endings regardless of the noun's gender.
const POSS_END_SG: Record<Gender, Record<CaseT, string>> = {
  m: { nom: '',  acc: 'en', dat: 'em' },
  f: { nom: 'e', acc: 'e',  dat: 'er' },
  n: { nom: '',  acc: '',   dat: 'em' },
};
const POSS_END_PL: Record<CaseT, string> = { nom: 'e', acc: 'e', dat: 'en' };

// Full set of possessive stems used by the drill. `ihr` covers her & their —
// the declension is identical, so they share a single stem.
export const POSSESSIVE_STEMS: PossessiveStem[] = [
  'mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'Ihr',
];

// English gloss for each possessive — shown next to the prompt so the learner
// knows which one to type when the same stem (e.g. `ihr`) covers two persons.
export const POSSESSIVE_GLOSS_EN: Record<PossessiveStem, string> = {
  mein: 'my',
  dein: 'your (sg)',
  sein: 'his / its',
  ihr: 'her / their',
  unser: 'our',
  euer: 'your (pl)',
  Ihr: 'your (formal)',
};
export const POSSESSIVE_GLOSS_DE: Record<PossessiveStem, string> = {
  mein: 'mein',
  dein: 'dein (du)',
  sein: 'sein / es',
  ihr: 'ihr (sie/sie pl)',
  unser: 'unser',
  euer: 'euer (ihr)',
  Ihr: 'Ihr (Sie)',
};
export const POSSESSIVE_GLOSS_ES: Record<PossessiveStem, string> = {
  mein: 'mi',
  dein: 'tu (tú)',
  sein: 'su (él / ello)',
  ihr: 'su (ella / ellos)',
  unser: 'nuestro/-a',
  euer: 'vuestro/-a',
  Ihr: 'su (usted)',
};

export function possessiveForm(
  stem: PossessiveStem,
  gender: Gender,
  number: NumberT,
  caseT: CaseT,
): string {
  const ending = number === 'pl' ? POSS_END_PL[caseT] : POSS_END_SG[gender][caseT];
  // `euer` drops the middle -e- whenever an ending is attached: euer → eure,
  // euren, eurem, eurer, eures. Without an ending it stays as `euer`.
  if (stem === 'euer' && ending !== '') return 'eur' + ending;
  return stem + ending;
}

// Dative plural: append -n unless plural already ends in -n or -s.
export function dativePlural(plural: string): string {
  if (/[ns]$/.test(plural)) return plural;
  return plural + 'n';
}

export function articleFor(
  gender: Gender,
  number: NumberT,
  caseT: CaseT,
  articleType: ArticleT,
  possessive?: PossessiveStem,
): string {
  if (articleType === 'poss') {
    if (!possessive) throw new Error('possessive stem required for poss articleType');
    return possessiveForm(possessive, gender, number, caseT);
  }
  if (number === 'pl') return DEF_PL[caseT];
  return articleType === 'def' ? DEF_SG[gender][caseT] : INDEF_SG[gender][caseT];
}

export function expectedAnswer(
  noun: Noun,
  number: NumberT,
  caseT: CaseT,
  articleType: ArticleT,
  possessive?: PossessiveStem,
): string {
  const article = articleFor(noun.gender, number, caseT, articleType, possessive);
  if (number === 'sg') return `${article} ${noun.singular}`;
  const pl = noun.plural ?? noun.singular;
  const form = caseT === 'dat' ? dativePlural(pl) : pl;
  return `${article} ${form}`;
}

export function cardId(
  nounId: string,
  number: NumberT,
  caseT: CaseT,
  articleType: ArticleT,
  possessive?: PossessiveStem,
): string {
  if (articleType === 'poss') {
    return `${nounId}|${number}|${caseT}|poss:${possessive}`;
  }
  return `${nounId}|${number}|${caseT}|${articleType}`;
}

export function generateCardsForNoun(noun: Noun): Card[] {
  const cases: CaseT[] = ['nom', 'acc', 'dat'];
  const cards: Card[] = [];
  const hasSingular = !noun.pluralOnly;
  const hasPlural = noun.pluralOnly || noun.plural !== null;

  if (hasSingular) {
    for (const c of cases) {
      cards.push({
        id: cardId(noun.id, 'sg', c, 'def'),
        nounId: noun.id,
        number: 'sg',
        case: c,
        articleType: 'def',
        expected: expectedAnswer(noun, 'sg', c, 'def'),
      });
      cards.push({
        id: cardId(noun.id, 'sg', c, 'indef'),
        nounId: noun.id,
        number: 'sg',
        case: c,
        articleType: 'indef',
        expected: expectedAnswer(noun, 'sg', c, 'indef'),
      });
      for (const stem of POSSESSIVE_STEMS) {
        cards.push({
          id: cardId(noun.id, 'sg', c, 'poss', stem),
          nounId: noun.id,
          number: 'sg',
          case: c,
          articleType: 'poss',
          possessive: stem,
          expected: expectedAnswer(noun, 'sg', c, 'poss', stem),
        });
      }
    }
  }
  if (hasPlural) {
    for (const c of cases) {
      cards.push({
        id: cardId(noun.id, 'pl', c, 'def'),
        nounId: noun.id,
        number: 'pl',
        case: c,
        articleType: 'def',
        expected: expectedAnswer(noun, 'pl', c, 'def'),
      });
      for (const stem of POSSESSIVE_STEMS) {
        cards.push({
          id: cardId(noun.id, 'pl', c, 'poss', stem),
          nounId: noun.id,
          number: 'pl',
          case: c,
          articleType: 'poss',
          possessive: stem,
          expected: expectedAnswer(noun, 'pl', c, 'poss', stem),
        });
      }
    }
  }
  return cards;
}

export function generateAllCards(nouns: Noun[]): Card[] {
  const out: Card[] = [];
  for (const n of nouns) {
    for (const c of generateCardsForNoun(n)) out.push(c);
  }
  return out;
}

export type AnswerCheck =
  | { kind: 'exact' }
  | { kind: 'typo'; distance: 1 }
  | { kind: 'article-mismatch'; usedArticleType: ArticleT }
  | { kind: 'wrong' };

export function checkAnswer(
  entered: string,
  expected: string,
  noun?: Noun,
  card?: Card,
): AnswerCheck {
  const e = entered.trim();
  if (e === expected) return { kind: 'exact' };

  // Article-system mismatch: the user typed the def/indef form when the card
  // asked for the other. Sentence-case on the article's first letter is
  // treated as free, and a single typo in the noun is forgiven so a stray
  // capital or letter slip doesn't cancel detection. Possessive cards opt
  // out — the def/indef-only mismatch notice text doesn't fit them.
  if (noun !== undefined && card !== undefined && card.articleType !== 'poss') {
    const eParts = splitArticleNoun(e);
    if (card.number === 'sg') {
      const opposite: ArticleT = card.articleType === 'def' ? 'indef' : 'def';
      const altParts = splitArticleNoun(
        expectedAnswer(noun, card.number, card.case, opposite),
      );
      if (
        eqLeadingCaseFree(eParts.article, altParts.article) &&
        nounsMatchForMismatch(eParts.noun, altParts.noun)
      ) {
        return { kind: 'article-mismatch', usedArticleType: opposite };
      }
    } else {
      // Plural def cards: detect an indef-singular article paired with the
      // right plural-noun form. Loose article match —
      // `ein/eine/einer/einen/einem/eines` are all unambiguously indefinite,
      // regardless of which case/gender.
      const xParts = splitArticleNoun(expected);
      if (
        INDEF_ARTICLE_RE.test(eParts.article) &&
        nounsMatchForMismatch(eParts.noun, xParts.noun)
      ) {
        return { kind: 'article-mismatch', usedArticleType: 'indef' };
      }
    }
  }

  const ePart = splitArticleNoun(e);
  const xPart = splitArticleNoun(expected);

  // The article (e.g. ein/eine/einer/einen, der/die/das/den/dem) is grammar,
  // not spelling — typo forgiveness does not apply to it. Differences in the
  // article are always wrong, even if they are only one character apart.
  if (!eqLeadingCaseFree(ePart.article, xPart.article)) return { kind: 'wrong' };

  if (ePart.noun === xPart.noun) return { kind: 'exact' };

  // If the entered noun is a *different* valid form of the same noun
  // (singular vs plural, raw plural vs dative plural), it's a grammar
  // mistake — never a typo, regardless of edit distance.
  if (noun !== undefined && otherNounForms(noun, xPart.noun).includes(ePart.noun)) {
    return { kind: 'wrong' };
  }

  if (levenshtein(ePart.noun, xPart.noun, 2) === 1) {
    // Umlauts must be exactly correct: if the single edit involves any
    // ä/ö/ü/ß (or capitals), it's a grammar/spelling error, not a typo.
    if (diffInvolvesUmlaut(ePart.noun, xPart.noun)) return { kind: 'wrong' };
    // Insertion or deletion at the very end of the noun is almost always a
    // grammatical mistake in German — wrong plural marker, missing dative-pl
    // -n, missing weak-noun -en, etc. — not a finger slip.
    if (isTrailingInsertOrDelete(ePart.noun, xPart.noun)) return { kind: 'wrong' };
    return { kind: 'typo', distance: 1 };
  }
  return { kind: 'wrong' };
}

// Any indef-singular article form, with optional sentence-case on the first
// letter. Covers ein/eine/einer/einen/einem/eines across genders and cases.
const INDEF_ARTICLE_RE = /^[Ee]in(e|er|en|em|es)?$/;

// True iff the entered noun is close enough to the expected noun that the
// real mistake is the article system, not the noun. Forgives a single typo
// (e.g. stray capital, mid-word slip) but holds the line on grammar-level
// noun errors — umlauts must be exact, and trailing insert/delete is the
// shape of a missing plural marker, not a finger slip.
function nounsMatchForMismatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (levenshtein(a, b, 1) !== 1) return false;
  if (diffInvolvesUmlaut(a, b)) return false;
  if (isTrailingInsertOrDelete(a, b)) return false;
  return true;
}

const UMLAUT_CHARS = /[äöüÄÖÜß]/;

// True iff the single Lev-1 edit is an insertion/deletion of the LAST
// character of the longer string. Substitutions return false (we don't
// penalize last-character substitutions). Caller must guarantee Lev(a,b)=1.
export function isTrailingInsertOrDelete(a: string, b: string): boolean {
  if (a.length === b.length) return false;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let i = 0;
  while (i < shorter.length && shorter[i] === longer[i]) i++;
  // The inserted/deleted char in `longer` lives at index i. If i is the last
  // index, the edit was at the end of the word.
  return i === longer.length - 1;
}

// Inspect the single Levenshtein-1 edit between a and b. Returns true iff
// either of the differing characters is an umlaut. Caller must guarantee
// Lev(a,b) ≤ 1; behavior for larger distances is undefined.
export function diffInvolvesUmlaut(a: string, b: string): boolean {
  if (a === b) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    // Substitution at position i.
    return UMLAUT_CHARS.test(a[i]) || UMLAUT_CHARS.test(b[i]);
  }
  // Insertion/deletion: the extra character lives in the longer string at i.
  const longer = a.length > b.length ? a : b;
  return UMLAUT_CHARS.test(longer[i]);
}

function splitArticleNoun(s: string): { article: string; noun: string } {
  const i = s.indexOf(' ');
  if (i < 0) return { article: '', noun: s };
  return { article: s.slice(0, i), noun: s.slice(i + 1) };
}

function eqLeadingCaseFree(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length !== b.length || a.length === 0) return false;
  return a[0].toLowerCase() === b[0].toLowerCase() && a.slice(1) === b.slice(1);
}

function otherNounForms(noun: Noun, exclude: string): string[] {
  const forms = new Set<string>();
  if (!noun.pluralOnly) forms.add(noun.singular);
  if (noun.plural !== null) {
    forms.add(noun.plural);
    forms.add(dativePlural(noun.plural));
  }
  forms.delete(exclude);
  return [...forms];
}

// Levenshtein distance with an early-exit cap. Returns the actual distance if
// it is ≤ cap, otherwise returns cap + 1.
export function levenshtein(a: string, b: string, cap = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}
