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

// Distinguishes shipped corpus nouns from ones the user added. Set in memory
// when the catalog loads; user nouns also persist it in the `userNouns` store,
// which is the boundary the cloud-sync layer reads/writes.
export type NounSource = 'builtin' | 'user';

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
  source?: NounSource;
  // Epoch-ms of the last local edit for user nouns; last-write-wins key when
  // custom nouns sync. Unset for builtin corpus nouns.
  updatedAt?: number;
}

// Fields the "My Nouns" add/edit form collects. `id`/`source` are assigned by
// CatalogService, and cards are generated from this — no ruleIds for user nouns.
export interface UserNounInput {
  singular: string;
  plural: string | null;
  pluralOnly: boolean;
  gender: Gender;
  english: string;
  importance: number;
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
  // Epoch-ms of the last local write. Stamped by DbService on every put and
  // used as the last-write-wins key by the cloud-sync layer. Optional so
  // existing construction sites need not set it; the DB backfills old rows.
  updatedAt?: number;
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
  // See CardState.updatedAt — last-write-wins key for cloud sync.
  updatedAt?: number;
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

// An ActivityEvent as persisted: the payload plus a client-generated stable id
// (uuid) so events dedupe across devices when synced. Replaces the old
// IndexedDB auto-increment numeric id.
export type StoredEvent = ActivityEvent & { id: string };

export interface ExportFile {
  // v2 carries userNouns and stable string event ids. v1 files (numeric/no
  // event ids, no userNouns) are still accepted on import for back-compat.
  schema: 'schleifer.v1' | 'schleifer.v2';
  exportedAt: number;
  catalogVersion: string;
  cardStates: CardState[];
  sessions: Session[];
  events: (ActivityEvent & { id?: string | number })[];
  userNouns?: Noun[];
}
