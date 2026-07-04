export type Gender = 'm' | 'f' | 'n';
export type CaseT = 'nom' | 'acc' | 'dat';
export type NumberT = 'sg' | 'pl';
export type ArticleT = 'def' | 'indef' | 'poss';
export type AnswerResult = 'correct' | 'incorrect' | 'idk' | 'skipped';

// Possessive stems. `ihr` covers both her and their (declension is identical);
// `Ihr` is formal-your and is kept distinct because the answer is capitalized.
export type PossessiveStem =
  | 'mein'
  | 'dein'
  | 'sein'
  | 'ihr'
  | 'unser'
  | 'euer'
  | 'Ihr';

export type CaseFilter = 'all' | CaseT;
export type NumberFilter = 'both' | NumberT;
// Article filter governs the def/indef axis only. Possessives are gated by
// `possessiveScope` so the user can opt them in/out without touching def/indef.
export type ArticleFilter = 'both' | 'def' | 'indef';
export type PossessiveScope = 'off' | 'basic2' | 'core4' | 'all7';

export interface AppSettings {
  caseFilter: CaseFilter;
  numberFilter: NumberFilter;
  articleFilter: ArticleFilter;
  possessiveScope: PossessiveScope;
}

export type TranslationDirection = 'de->en' | 'en->de';

export interface TranslationQuestion {
  nounId: string;
  direction: TranslationDirection;
  prompt: string;
  choices: string[];
  answerIndex: number;
}

export interface Noun {
  id: string;
  singular: string;
  plural: string | null;
  pluralOnly: boolean;
  gender: Gender;
  importance: number;
  english: string;
  ruleIds?: number[];
  primaryRuleId?: number;
}

export interface Rule {
  id: number;
  title: string;
  expectedGender: string;
  feedbackMessage: string;
}

export interface NounCatalog {
  catalogVersion: string;
  nouns: Noun[];
  rules: Rule[];
}

export interface Card {
  id: string;
  nounId: string;
  number: NumberT;
  case: CaseT;
  articleType: ArticleT;
  // Only set when articleType === 'poss'.
  possessive?: PossessiveStem;
  expected: string;
}

export interface CardState {
  cardId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  due: number;
  lapses: number;
  lastShownAt: number | null;
  lastResult: AnswerResult | null;
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number | null;
  targetCount: number;
  presented: number;
  correct: number;
  incorrect: number;
  idk: number;
  skipped: number;
}

export interface AnswerPrompt {
  singular: string;
  plural: string | null;
  gender: Gender;
  case: CaseT;
  number: NumberT;
  articleType: ArticleT;
  possessive?: PossessiveStem;
}

export type ActivityEvent =
  | { kind: 'session_start'; ts: number; sessionId: string }
  | {
      kind: 'session_end';
      ts: number;
      sessionId: string;
      summary: Pick<Session, 'presented' | 'correct' | 'incorrect' | 'idk' | 'skipped'>;
    }
  | {
      kind: 'answer';
      ts: number;
      sessionId: string;
      cardId: string;
      prompt: AnswerPrompt;
      entered: string;
      expected: string;
      result: AnswerResult;
      typo?: boolean;
    }
  | { kind: 'import'; ts: number; counts: Record<string, number> }
  | { kind: 'export'; ts: number; counts: Record<string, number> };

export interface ExportFile {
  schema: 'schleifer.v1';
  exportedAt: number;
  catalogVersion: string;
  cardStates: CardState[];
  sessions: Session[];
  events: (ActivityEvent & { id?: number })[];
}
