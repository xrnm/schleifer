import {
  checkAnswer,
  dativePlural,
  expectedAnswer,
  generateCardsForNoun,
  levenshtein,
} from './declension';
import { Card, Noun } from '../models/types';

const tisch: Noun = {
  id: 'tisch',
  singular: 'Tisch',
  plural: 'Tische',
  pluralOnly: false,
  gender: 'm',
  importance: 5,
  english: 'table',
};
const frau: Noun = {
  id: 'frau',
  singular: 'Frau',
  plural: 'Frauen',
  pluralOnly: false,
  gender: 'f',
  importance: 10,
  english: 'woman',
};
const haus: Noun = {
  id: 'haus',
  singular: 'Haus',
  plural: 'Häuser',
  pluralOnly: false,
  gender: 'n',
  importance: 10,
  english: 'house',
};
const auto: Noun = {
  id: 'auto',
  singular: 'Auto',
  plural: 'Autos',
  pluralOnly: false,
  gender: 'n',
  importance: 8,
  english: 'car',
};
const deutsch: Noun = {
  id: 'deutsch',
  singular: 'Deutsch',
  plural: null,
  pluralOnly: false,
  gender: 'n',
  importance: 10,
  english: 'German',
};
const leute: Noun = {
  id: 'leute',
  singular: 'Leute',
  plural: 'Leute',
  pluralOnly: true,
  gender: 'f',
  importance: 10,
  english: 'people',
};

describe('dativePlural mutation', () => {
  it('appends -n when plural does not end in n or s', () => {
    expect(dativePlural('Tische')).toBe('Tischen');
    expect(dativePlural('Häuser')).toBe('Häusern');
  });
  it('leaves -n endings alone', () => {
    expect(dativePlural('Frauen')).toBe('Frauen');
  });
  it('leaves -s endings alone', () => {
    expect(dativePlural('Autos')).toBe('Autos');
  });
});

describe('expectedAnswer', () => {
  it('masculine singular cases', () => {
    expect(expectedAnswer(tisch, 'sg', 'nom', 'def')).toBe('der Tisch');
    expect(expectedAnswer(tisch, 'sg', 'acc', 'def')).toBe('den Tisch');
    expect(expectedAnswer(tisch, 'sg', 'dat', 'def')).toBe('dem Tisch');
    expect(expectedAnswer(tisch, 'sg', 'nom', 'indef')).toBe('ein Tisch');
    expect(expectedAnswer(tisch, 'sg', 'acc', 'indef')).toBe('einen Tisch');
    expect(expectedAnswer(tisch, 'sg', 'dat', 'indef')).toBe('einem Tisch');
  });
  it('feminine singular cases', () => {
    expect(expectedAnswer(frau, 'sg', 'nom', 'def')).toBe('die Frau');
    expect(expectedAnswer(frau, 'sg', 'acc', 'def')).toBe('die Frau');
    expect(expectedAnswer(frau, 'sg', 'dat', 'def')).toBe('der Frau');
    expect(expectedAnswer(frau, 'sg', 'nom', 'indef')).toBe('eine Frau');
    expect(expectedAnswer(frau, 'sg', 'dat', 'indef')).toBe('einer Frau');
  });
  it('neuter singular cases', () => {
    expect(expectedAnswer(haus, 'sg', 'nom', 'def')).toBe('das Haus');
    expect(expectedAnswer(haus, 'sg', 'acc', 'def')).toBe('das Haus');
    expect(expectedAnswer(haus, 'sg', 'dat', 'def')).toBe('dem Haus');
    expect(expectedAnswer(haus, 'sg', 'nom', 'indef')).toBe('ein Haus');
    expect(expectedAnswer(haus, 'sg', 'acc', 'indef')).toBe('ein Haus');
  });
  it('plural cases with dative mutation', () => {
    expect(expectedAnswer(tisch, 'pl', 'nom', 'def')).toBe('die Tische');
    expect(expectedAnswer(tisch, 'pl', 'acc', 'def')).toBe('die Tische');
    expect(expectedAnswer(tisch, 'pl', 'dat', 'def')).toBe('den Tischen');
    expect(expectedAnswer(frau, 'pl', 'dat', 'def')).toBe('den Frauen');
    expect(expectedAnswer(auto, 'pl', 'dat', 'def')).toBe('den Autos');
    expect(expectedAnswer(haus, 'pl', 'dat', 'def')).toBe('den Häusern');
  });
});

describe('generateCardsForNoun', () => {
  it('generates 9 cards for standard noun', () => {
    expect(generateCardsForNoun(tisch).length).toBe(9);
  });
  it('generates 6 cards for mass noun (no plural)', () => {
    const cards = generateCardsForNoun(deutsch);
    expect(cards.length).toBe(6);
    expect(cards.every(c => c.number === 'sg')).toBe(true);
  });
  it('generates 3 cards for plural-only noun', () => {
    const cards = generateCardsForNoun(leute);
    expect(cards.length).toBe(3);
    expect(cards.every(c => c.number === 'pl')).toBe(true);
    expect(cards.every(c => c.articleType === 'def')).toBe(true);
  });
});

describe('levenshtein', () => {
  it('basic distances', () => {
    expect(levenshtein('a', 'a')).toBe(0);
    expect(levenshtein('a', 'b')).toBe(1);
    expect(levenshtein('Tisch', 'Tish')).toBe(1);   // delete
    expect(levenshtein('Tisch', 'Tichs')).toBe(2);  // transposition = 2 in pure Lev
    expect(levenshtein('Tisch', 'Tische')).toBe(1); // insert
  });
  it('respects cap with early exit', () => {
    expect(levenshtein('abcdef', 'xyzqrs', 2)).toBe(3); // > 2 returns cap+1
  });
});

describe('checkAnswer', () => {
  it('exact match', () => {
    expect(checkAnswer('den Tisch', 'den Tisch')).toEqual({ kind: 'exact' });
  });
  it('first letter case on the article is free', () => {
    expect(checkAnswer('Den Tisch', 'den Tisch')).toEqual({ kind: 'exact' });
    expect(checkAnswer('die Frau', 'Die Frau')).toEqual({ kind: 'exact' });
  });
  it('one-letter typo in the middle of the noun is accepted', () => {
    expect(checkAnswer('den Tish', 'den Tisch')).toEqual({ kind: 'typo', distance: 1 });
    expect(checkAnswer('den tisch', 'den Tisch')).toEqual({ kind: 'typo', distance: 1 });
  });

  it('insertion or deletion at the end of the noun is a grammar miss, not a typo', () => {
    // Real example: missing the trailing -n on the plural form.
    expect(checkAnswer('die Kompetenze', 'die Kompetenzen')).toEqual({ kind: 'wrong' });
    // Extra char appended.
    expect(checkAnswer('die Frauu', 'die Frau')).toEqual({ kind: 'wrong' });
    // Missing dative-plural -n.
    expect(checkAnswer('den Tische', 'den Tischen')).toEqual({ kind: 'wrong' });
  });
  it('article ending differences are grammar mistakes, never typos', () => {
    expect(checkAnswer('ein Tisch', 'einen Tisch')).toEqual({ kind: 'wrong' });
    expect(checkAnswer('eine Frau', 'einer Frau')).toEqual({ kind: 'wrong' });
    expect(checkAnswer('einer Frau', 'eine Frau')).toEqual({ kind: 'wrong' });
    expect(checkAnswer('einen Tisch', 'einem Tisch')).toEqual({ kind: 'wrong' });
    expect(checkAnswer('einen Tisch', 'eine Tisch')).toEqual({ kind: 'wrong' });
  });
  it('any other article difference is wrong, regardless of distance', () => {
    expect(checkAnswer('der Frau', 'die Frau')).toEqual({ kind: 'wrong' });
    expect(checkAnswer('den Tisch', 'dem Tisch')).toEqual({ kind: 'wrong' });
  });
  it('two-letter mistakes on the noun are wrong', () => {
    expect(checkAnswer('den Tixx', 'den Tisch')).toEqual({ kind: 'wrong' });
    expect(checkAnswer('die Frua', 'die Frau')).toEqual({ kind: 'wrong' }); // transposition = distance 2
  });
  it('trims surrounding whitespace', () => {
    expect(checkAnswer('  den Tisch  ', 'den Tisch')).toEqual({ kind: 'exact' });
  });
  it('completely wrong', () => {
    expect(checkAnswer('totally-wrong', 'den Tisch')).toEqual({ kind: 'wrong' });
  });

  it('singular form when plural was expected is a grammar miss, not a typo', () => {
    const wuerde: Noun = {
      id: 'wuerde', singular: 'Würde', plural: 'Würden', pluralOnly: false,
      gender: 'f', importance: 5, english: 'dignity',
    };
    expect(checkAnswer('die Würde', 'die Würden', wuerde)).toEqual({ kind: 'wrong' });
    expect(checkAnswer('die Würden', 'die Würde', wuerde)).toEqual({ kind: 'wrong' });
  });

  it('raw plural when dative-plural was expected is a grammar miss', () => {
    const tisch_: Noun = {
      id: 'tisch', singular: 'Tisch', plural: 'Tische', pluralOnly: false,
      gender: 'm', importance: 5, english: 'table',
    };
    expect(checkAnswer('den Tische', 'den Tischen', tisch_)).toEqual({ kind: 'wrong' });
  });

  it('still allows typos that are not grammar alternates', () => {
    const tisch_: Noun = {
      id: 'tisch', singular: 'Tisch', plural: 'Tische', pluralOnly: false,
      gender: 'm', importance: 5, english: 'table',
    };
    expect(checkAnswer('den Tish', 'den Tisch', tisch_)).toEqual({ kind: 'typo', distance: 1 });
  });

  it('umlaut differences are never typos — they must be exact', () => {
    expect(checkAnswer('das Madchen', 'das Mädchen')).toEqual({ kind: 'wrong' });
    expect(checkAnswer('die Hauser', 'die Häuser')).toEqual({ kind: 'wrong' });
    // ß handling
    expect(checkAnswer('die Strasse', 'die Straße')).toEqual({ kind: 'wrong' });
    // Differing umlaut character (ä vs ö)
    expect(checkAnswer('das Mödchen', 'das Mädchen')).toEqual({ kind: 'wrong' });
  });

  it('umlaut substitution mid-word is wrong, not typo', () => {
    expect(checkAnswer('die Mätter', 'die Mütter')).toEqual({ kind: 'wrong' });
  });

  describe('article-system mismatch (def vs indef)', () => {
    const tischDefAcc: Card = {
      id: 'tisch|sg|acc|def', nounId: 'tisch',
      number: 'sg', case: 'acc', articleType: 'def',
      expected: 'den Tisch',
    };
    const tischIndefAcc: Card = {
      id: 'tisch|sg|acc|indef', nounId: 'tisch',
      number: 'sg', case: 'acc', articleType: 'indef',
      expected: 'einen Tisch',
    };

    it('flags indef form when def was asked', () => {
      expect(checkAnswer('einen Tisch', 'den Tisch', tisch, tischDefAcc))
        .toEqual({ kind: 'article-mismatch', usedArticleType: 'indef' });
    });
    it('flags def form when indef was asked', () => {
      expect(checkAnswer('den Tisch', 'einen Tisch', tisch, tischIndefAcc))
        .toEqual({ kind: 'article-mismatch', usedArticleType: 'def' });
    });
    it('fires on plural cards when the user used an indef-singular article', () => {
      // Real example: "Einen Seminaren" against an expected "den Seminaren"
      // dative-plural card — user picked the indefinite article on a plural.
      const seminar: Noun = {
        id: 'seminar', singular: 'Seminar', plural: 'Seminare',
        pluralOnly: false, gender: 'n', importance: 5, english: 'seminar',
      };
      const seminarDefDatPl: Card = {
        id: 'seminar|pl|dat|def', nounId: 'seminar',
        number: 'pl', case: 'dat', articleType: 'def',
        expected: 'den Seminaren',
      };
      // The user even used the wrong gender's indef article — `einen` is
      // masc-acc-sg — but the indefinite intent is unambiguous.
      expect(checkAnswer('Einen Seminaren', 'den Seminaren', seminar, seminarDefDatPl))
        .toEqual({ kind: 'article-mismatch', usedArticleType: 'indef' });
      // Same with a gender-correct indef article.
      expect(checkAnswer('einem Seminaren', 'den Seminaren', seminar, seminarDefDatPl))
        .toEqual({ kind: 'article-mismatch', usedArticleType: 'indef' });
    });
    it('plural article-mismatch requires the plural noun form, not singular', () => {
      // Same indef-singular article, but the user typed the singular noun
      // form — that is "wrong number", not "wrong article system".
      const seminar: Noun = {
        id: 'seminar', singular: 'Seminar', plural: 'Seminare',
        pluralOnly: false, gender: 'n', importance: 5, english: 'seminar',
      };
      const seminarDefDatPl: Card = {
        id: 'seminar|pl|dat|def', nounId: 'seminar',
        number: 'pl', case: 'dat', articleType: 'def',
        expected: 'den Seminaren',
      };
      expect(checkAnswer('einem Seminar', 'den Seminaren', seminar, seminarDefDatPl))
        .toEqual({ kind: 'wrong' });
    });
    it('plural article-mismatch holds the line on missing -n in dative plural', () => {
      // Trailing edit = grammar miss, not a slip — even with the indef article.
      const seminar: Noun = {
        id: 'seminar', singular: 'Seminar', plural: 'Seminare',
        pluralOnly: false, gender: 'n', importance: 5, english: 'seminar',
      };
      const seminarDefDatPl: Card = {
        id: 'seminar|pl|dat|def', nounId: 'seminar',
        number: 'pl', case: 'dat', articleType: 'def',
        expected: 'den Seminaren',
      };
      expect(checkAnswer('einem Seminare', 'den Seminaren', seminar, seminarDefDatPl))
        .toEqual({ kind: 'wrong' });
    });
    it('still flags wrong article system on plurals as plain wrong without a card', () => {
      // No card supplied → mismatch detection is skipped.
      expect(checkAnswer('einen Tische', 'die Tische', tisch))
        .toEqual({ kind: 'wrong' });
    });
    it('forgives a single typo in the noun (Der KRise vs einer Krise)', () => {
      // Real example: stray capital R mid-word should not cancel article-
      // mismatch detection — the article-system swap (def↔indef) is what
      // the user got wrong, not the noun.
      const krise: Noun = {
        id: 'krise', singular: 'Krise', plural: 'Krisen',
        pluralOnly: false, gender: 'f', importance: 5, english: 'crisis',
      };
      const kriseIndefDat: Card = {
        id: 'krise|sg|dat|indef', nounId: 'krise',
        number: 'sg', case: 'dat', articleType: 'indef',
        expected: 'einer Krise',
      };
      expect(checkAnswer('Der KRise', 'einer Krise', krise, kriseIndefDat))
        .toEqual({ kind: 'article-mismatch', usedArticleType: 'def' });
    });
    it('does not over-forgive umlaut errors in the noun under mismatch', () => {
      // Mismatch detection must not paper over an umlaut error on the noun.
      const haus_: Noun = {
        id: 'haus', singular: 'Haus', plural: 'Häuser',
        pluralOnly: false, gender: 'n', importance: 5, english: 'house',
      };
      const hausIndefDat: Card = {
        id: 'haus|sg|dat|indef', nounId: 'haus',
        number: 'sg', case: 'dat', articleType: 'indef',
        expected: 'einem Haus',
      };
      // 'Häus' uses an umlaut where 'Haus' did not — never a typo.
      expect(checkAnswer('dem Häus', 'einem Haus', haus_, hausIndefDat))
        .toEqual({ kind: 'wrong' });
    });
    it('falls through to existing logic when no card is supplied', () => {
      expect(checkAnswer('einen Tisch', 'den Tisch', tisch))
        .toEqual({ kind: 'wrong' });
    });
    it('tolerates sentence-case on the article (Die Hoffnung vs eine Hoffnung)', () => {
      const hoffnung: Noun = {
        id: 'hoffnung', singular: 'Hoffnung', plural: 'Hoffnungen',
        pluralOnly: false, gender: 'f', importance: 5, english: 'hope',
      };
      const card: Card = {
        id: 'hoffnung|sg|nom|indef', nounId: 'hoffnung',
        number: 'sg', case: 'nom', articleType: 'indef',
        expected: 'eine Hoffnung',
      };
      expect(checkAnswer('Die Hoffnung', 'eine Hoffnung', hoffnung, card))
        .toEqual({ kind: 'article-mismatch', usedArticleType: 'def' });
    });
  });
});
