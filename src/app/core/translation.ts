import { Noun, TranslationDirection, TranslationQuestion } from '../models/types';

const TRANSLATION_SUFFIX = '|translation';

export function translationCardId(nounId: string): string {
  return `${nounId}${TRANSLATION_SUFFIX}`;
}

export function isTranslationCardId(id: string): boolean {
  return id.endsWith(TRANSLATION_SUFFIX);
}

export function nounIdFromTranslationCardId(id: string): string {
  return id.slice(0, -TRANSLATION_SUFFIX.length);
}

const NUM_CHOICES = 4;

/**
 * Build a translation MC question for `noun`. `direction` is chosen randomly
 * by default. Distractors are picked from `allNouns` (other nouns), favoring
 * unique glosses so the four choices read cleanly.
 */
export function buildTranslationQuestion(
  noun: Noun,
  allNouns: Noun[],
  rand: () => number = Math.random,
  forcedDirection?: TranslationDirection,
): TranslationQuestion {
  const direction: TranslationDirection =
    forcedDirection ?? (rand() < 0.5 ? 'de->en' : 'en->de');

  const prompt = direction === 'de->en' ? deSurface(noun) : noun.english;
  const correct = direction === 'de->en' ? noun.english : deSurface(noun);

  const seen = new Set<string>([correct.toLowerCase()]);
  const distractors: string[] = [];
  const pool = allNouns.filter(
    (n) => n.id !== noun.id && (direction === 'de->en' ? !!n.english : !!deSurface(n)),
  );

  // Fisher–Yates shuffle a copy, then greedily collect unique-gloss distractors.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const cand of shuffled) {
    if (distractors.length >= NUM_CHOICES - 1) break;
    const val = direction === 'de->en' ? cand.english : deSurface(cand);
    const key = val.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(val);
  }

  const choices = [correct, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return {
    nounId: noun.id,
    direction,
    prompt,
    choices,
    answerIndex: choices.indexOf(correct),
  };
}

/**
 * Surface form used for German prompts/choices in translation mode. Plural-only
 * nouns use the plural; everything else uses the singular. No article.
 */
export function deSurface(noun: Noun): string {
  if (noun.pluralOnly && noun.plural) return noun.plural;
  return noun.singular;
}
