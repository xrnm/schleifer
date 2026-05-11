import { Noun } from '../models/types';
import {
  buildTranslationQuestion,
  isTranslationCardId,
  nounIdFromTranslationCardId,
  translationCardId,
} from './translation';

function makeNoun(id: string, singular: string, english: string): Noun {
  return {
    id,
    singular,
    plural: null,
    pluralOnly: false,
    gender: 'm',
    importance: 5,
    english,
  };
}

describe('translation', () => {
  describe('id helpers', () => {
    it('round-trips a noun id', () => {
      expect(translationCardId('Jahr')).toBe('Jahr|translation');
      expect(isTranslationCardId('Jahr|translation')).toBe(true);
      expect(isTranslationCardId('Jahr|sg|nom|def')).toBe(false);
      expect(nounIdFromTranslationCardId('Jahr|translation')).toBe('Jahr');
    });
  });

  describe('buildTranslationQuestion', () => {
    const nouns = [
      makeNoun('Jahr', 'Jahr', 'year'),
      makeNoun('Mann', 'Mann', 'man'),
      makeNoun('Frau', 'Frau', 'woman'),
      makeNoun('Kind', 'Kind', 'child'),
      makeNoun('Hund', 'Hund', 'dog'),
      makeNoun('Katze', 'Katze', 'cat'),
    ];

    it('puts the correct answer at answerIndex (de->en)', () => {
      const q = buildTranslationQuestion(nouns[0], nouns, () => 0.1, 'de->en');
      expect(q.choices[q.answerIndex]).toBe('year');
      expect(q.prompt).toBe('Jahr');
      expect(q.choices.length).toBe(4);
    });

    it('puts the correct answer at answerIndex (en->de)', () => {
      const q = buildTranslationQuestion(nouns[0], nouns, () => 0.9, 'en->de');
      expect(q.choices[q.answerIndex]).toBe('Jahr');
      expect(q.prompt).toBe('year');
    });

    it('returns 4 unique choices', () => {
      const q = buildTranslationQuestion(nouns[0], nouns, () => 0.5);
      const lower = q.choices.map((c) => c.toLowerCase());
      expect(new Set(lower).size).toBe(q.choices.length);
    });

    it('never includes the prompt noun as a distractor', () => {
      const q = buildTranslationQuestion(nouns[0], nouns, () => 0.3, 'de->en');
      const expectedAnswer = q.choices[q.answerIndex];
      const distractors = q.choices.filter((_, i) => i !== q.answerIndex);
      for (const d of distractors) expect(d).not.toBe('Jahr');
      // And the correct answer is exactly the noun's English gloss.
      expect(expectedAnswer).toBe('year');
    });

    it('alternates direction roughly 50/50 over many trials', () => {
      let de = 0;
      const rng = makeSeededRng(42);
      for (let i = 0; i < 200; i++) {
        const q = buildTranslationQuestion(nouns[0], nouns, rng);
        if (q.direction === 'de->en') de++;
      }
      expect(de).toBeGreaterThan(60);
      expect(de).toBeLessThan(140);
    });

    it('uses the plural surface for plural-only nouns', () => {
      const pluralOnly: Noun = {
        id: 'Leute',
        singular: 'Leute',
        plural: 'Leute',
        pluralOnly: true,
        gender: 'f',
        importance: 5,
        english: 'people',
      };
      const q = buildTranslationQuestion(pluralOnly, [...nouns, pluralOnly], () => 0.1, 'de->en');
      expect(q.prompt).toBe('Leute');
    });
  });
});

function makeSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}
