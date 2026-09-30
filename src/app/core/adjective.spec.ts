import {
  AdjCell,
  adjCellId,
  adjDeterminer,
  adjPhraseGlossEn,
  adjectiveEnding,
  allAdjCells,
  checkAdjAnswer,
  declineAdjective,
  detectAdjClassMismatch,
  expectedAdjPhrase,
  isAdjectiveCardId,
  parseAdjCellId,
  pickAdjSurface,
} from './adjective';
import { AdjectiveEntry, Noun } from '../models/types';

const gut: AdjectiveEntry = { id: 'gut', base: 'gut', en: 'good', de: 'gut', es: 'bueno', nounIds: [] };
const hoch: AdjectiveEntry = { id: 'hoch', base: 'hoch', stem: 'hoh', en: 'high', de: 'hoch', es: 'alto', nounIds: [] };
const teuer: AdjectiveEntry = { id: 'teuer', base: 'teuer', stem: 'teur', en: 'expensive', de: 'teuer', es: 'caro', nounIds: [] };

const wein: Noun = { id: 'wein', singular: 'Wein', plural: 'Weine', pluralOnly: false, gender: 'm', importance: 5, english: 'wine' };
const frau: Noun = { id: 'frau', singular: 'Frau', plural: 'Frauen', pluralOnly: false, gender: 'f', importance: 5, english: 'woman' };
const wasser: Noun = { id: 'wasser', singular: 'Wasser', plural: 'Wässer', pluralOnly: false, gender: 'n', importance: 5, english: 'water' };
const haus: Noun = { id: 'haus', singular: 'Haus', plural: 'Häuser', pluralOnly: false, gender: 'n', importance: 5, english: 'house' };
const fenster: Noun = { id: 'fenster', singular: 'Fenster', plural: 'Fenster', pluralOnly: false, gender: 'n', importance: 5, english: 'window' };
const mann: Noun = { id: 'mann', singular: 'Mann', plural: 'Männer', pluralOnly: false, gender: 'm', importance: 5, english: 'man' };

const sg = (cls: AdjCell['cls'], gender: AdjCell['gender'], c: AdjCell['case']): AdjCell => ({ cls, number: 'sg', case: c, gender });
const pl = (cls: AdjCell['cls'], c: AdjCell['case']): AdjCell => ({ cls, number: 'pl', case: c });

describe('adjective endings', () => {
  it('weak endings: -e in the singular nominative, -en spreading through', () => {
    expect(adjectiveEnding(sg('weak', 'm', 'nom'))).toBe('e');
    expect(adjectiveEnding(sg('weak', 'm', 'acc'))).toBe('en');
    expect(adjectiveEnding(sg('weak', 'f', 'dat'))).toBe('en');
    expect(adjectiveEnding(pl('weak', 'nom'))).toBe('en');
  });

  it('mixed endings mirror the strong article in the singular', () => {
    expect(adjectiveEnding(sg('mixed', 'm', 'nom'))).toBe('er');
    expect(adjectiveEnding(sg('mixed', 'n', 'nom'))).toBe('es');
    expect(adjectiveEnding(sg('mixed', 'm', 'acc'))).toBe('en');
  });

  it('strong endings carry the full case/gender signal', () => {
    expect(adjectiveEnding(sg('strong', 'm', 'nom'))).toBe('er');
    expect(adjectiveEnding(sg('strong', 'n', 'nom'))).toBe('es');
    expect(adjectiveEnding(sg('strong', 'm', 'dat'))).toBe('em');
    expect(adjectiveEnding(sg('strong', 'f', 'dat'))).toBe('er');
    expect(adjectiveEnding(pl('strong', 'nom'))).toBe('e');
    expect(adjectiveEnding(pl('strong', 'dat'))).toBe('en');
  });
});

describe('declineAdjective — stem quirks', () => {
  it('attaches endings to base for regular adjectives', () => {
    expect(declineAdjective(gut, sg('weak', 'm', 'nom'))).toBe('gute');
    expect(declineAdjective(gut, sg('strong', 'm', 'dat'))).toBe('gutem');
  });

  it('uses the contracted stem for hoch → hoh- and teuer → teur-', () => {
    expect(declineAdjective(hoch, sg('mixed', 'n', 'nom'))).toBe('hohes');
    expect(declineAdjective(hoch, sg('weak', 'n', 'dat'))).toBe('hohen');
    expect(declineAdjective(teuer, sg('strong', 'n', 'dat'))).toBe('teurem');
    expect(declineAdjective(teuer, sg('strong', 'n', 'nom'))).toBe('teures');
  });
});

describe('adjDeterminer', () => {
  it('weak → definite article', () => {
    expect(adjDeterminer(sg('weak', 'm', 'dat'), 'm')).toBe('dem');
    expect(adjDeterminer(pl('weak', 'dat'), 'm')).toBe('den');
  });
  it('mixed → ein in singular, mein in plural', () => {
    expect(adjDeterminer(sg('mixed', 'm', 'nom'), 'm')).toBe('ein');
    expect(adjDeterminer(sg('mixed', 'f', 'dat'), 'f')).toBe('einer');
    expect(adjDeterminer(pl('mixed', 'nom'), 'm')).toBe('meine');
    expect(adjDeterminer(pl('mixed', 'dat'), 'm')).toBe('meinen');
  });
  it('strong → no determiner', () => {
    expect(adjDeterminer(sg('strong', 'n', 'dat'), 'n')).toBe('');
  });
});

describe('expectedAdjPhrase', () => {
  it('the Fenster example resolves to the neuter form', () => {
    expect(expectedAdjPhrase(gut, fenster, sg('mixed', 'n', 'nom'))).toBe('ein gutes Fenster');
  });
  it('weak / mixed / strong across a masculine noun', () => {
    expect(expectedAdjPhrase(gut, wein, sg('weak', 'm', 'dat'))).toBe('dem guten Wein');
    expect(expectedAdjPhrase(gut, wein, sg('mixed', 'm', 'nom'))).toBe('ein guter Wein');
    expect(expectedAdjPhrase(gut, wasser, sg('strong', 'n', 'dat'))).toBe('gutem Wasser');
  });
  it('dative plural adds the -n on the noun', () => {
    expect(expectedAdjPhrase(gut, wein, pl('weak', 'dat'))).toBe('den guten Weinen');
    expect(expectedAdjPhrase(gut, wein, pl('mixed', 'dat'))).toBe('meinen guten Weinen');
  });
  it('irregular stem in a real phrase', () => {
    expect(expectedAdjPhrase(hoch, haus, sg('mixed', 'n', 'nom'))).toBe('ein hohes Haus');
  });
});

describe('adjPhraseGlossEn', () => {
  it('composes the whole phrase in English', () => {
    expect(adjPhraseGlossEn(gut, fenster, sg('mixed', 'n', 'nom'))).toBe('a good window');
    expect(adjPhraseGlossEn(gut, wein, sg('weak', 'm', 'dat'))).toBe('the good wine');
    expect(adjPhraseGlossEn(gut, wasser, sg('strong', 'n', 'dat'))).toBe('good water');
    expect(adjPhraseGlossEn(gut, wein, pl('mixed', 'nom'))).toBe('my good wines');
  });
  it('uses irregular English plurals in the gloss', () => {
    expect(adjPhraseGlossEn(gut, mann, pl('strong', 'nom'))).toBe('good men');
    expect(adjPhraseGlossEn(gut, mann, pl('weak', 'nom'))).toBe('the good men');
    expect(adjPhraseGlossEn(gut, mann, pl('mixed', 'nom'))).toBe('my good men');
  });
});

describe('card ids', () => {
  it('there are 36 ending cells and all ids round-trip', () => {
    const cells = allAdjCells();
    expect(cells.length).toBe(36);
    for (const cell of cells) {
      const id = adjCellId(cell);
      expect(isAdjectiveCardId(id)).toBe(true);
      expect(parseAdjCellId(id)).toEqual(cell);
    }
  });
  it('rejects non-adjective ids', () => {
    expect(isAdjectiveCardId('wein|sg|nom|def')).toBe(false);
    expect(isAdjectiveCardId('wein|translation')).toBe(false);
    expect(parseAdjCellId('wein|translation')).toBeNull();
  });
});

describe('checkAdjAnswer', () => {
  it('accepts the exact phrase and collapses whitespace', () => {
    expect(checkAdjAnswer('dem guten Wein', 'dem guten Wein').kind).toBe('exact');
    expect(checkAdjAnswer('  gutem   Wasser ', 'gutem Wasser').kind).toBe('exact');
  });
  it('accepts a capital first letter silently — no flag', () => {
    expect(checkAdjAnswer('Dem guten Wein', 'dem guten Wein').kind).toBe('exact');
    expect(checkAdjAnswer('Gutem Wasser', 'gutem Wasser').kind).toBe('exact');
    expect(checkAdjAnswer('Die saubere Straße', 'die saubere Straße').kind).toBe('exact');
  });
  it('flags other stray capitals but still accepts them', () => {
    // Mid-phrase capitals (beyond the first letter) are accepted but flagged.
    expect(checkAdjAnswer('die Saubere Straße', 'die saubere Straße').kind).toBe('caps');
    expect(checkAdjAnswer('Die Saubere Straße', 'die saubere Straße').kind).toBe('caps');
    expect(checkAdjAnswer('gutem wasser', 'gutem Wasser').kind).toBe('caps');
  });
  it('forgives a single typo in the noun only', () => {
    // 'Wain' is a single mid-word substitution of 'Wein' — a finger slip.
    expect(checkAdjAnswer('dem guten Wain', 'dem guten Wein').kind).toBe('typo');
  });
  it('a wrong adjective ending is grammar, never a typo', () => {
    expect(checkAdjAnswer('dem gutem Wein', 'dem guten Wein').kind).toBe('wrong');
    expect(checkAdjAnswer('der gute Wein', 'dem guten Wein').kind).toBe('wrong');
  });
  it('umlaut and trailing-marker slips in the noun are grammar, not typos', () => {
    expect(checkAdjAnswer('gutem Wasser', 'gutem Wässer').kind).toBe('wrong');
    expect(checkAdjAnswer('den guten Weine', 'den guten Weinen').kind).toBe('wrong');
  });
});

describe('detectAdjClassMismatch', () => {
  const strongDatM = sg('strong', 'm', 'dat'); // expected: "gutem Wein"
  it('flags the weak form typed on a strong card', () => {
    expect(detectAdjClassMismatch('dem guten Wein', gut, wein, strongDatM)).toBe('weak');
  });
  it('flags the mixed form typed on a strong card', () => {
    expect(detectAdjClassMismatch('einem guten Wein', gut, wein, strongDatM)).toBe('mixed');
  });
  it('forgives capitalization when matching another class', () => {
    expect(detectAdjClassMismatch('Dem guten Wein', gut, wein, strongDatM)).toBe('weak');
  });
  it('returns null for a plain wrong answer', () => {
    expect(detectAdjClassMismatch('quatsch', gut, wein, strongDatM)).toBeNull();
  });
  it('returns null for the correct current-class answer', () => {
    expect(detectAdjClassMismatch('gutem Wein', gut, wein, strongDatM)).toBeNull();
  });
});

describe('pickAdjSurface', () => {
  const adjs: AdjectiveEntry[] = [
    { ...gut, nounIds: ['wein', 'frau', 'fenster'] },
  ];
  const nounById = new Map<string, Noun>([
    ['wein', wein],
    ['frau', frau],
    ['fenster', fenster],
  ]);
  it('respects the cell gender in the singular', () => {
    const s = pickAdjSurface(sg('weak', 'f', 'nom'), adjs, nounById, () => 0);
    expect(s?.noun.gender).toBe('f');
  });
  it('only picks plural-capable nouns in the plural', () => {
    const s = pickAdjSurface(pl('weak', 'nom'), adjs, nounById, () => 0);
    expect(s).not.toBeNull();
    expect(s!.noun.plural).not.toBeNull();
  });
});
