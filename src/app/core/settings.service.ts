import { Injectable, signal } from '@angular/core';
import {
  AdjClassFilter,
  AppSettings,
  ArticleFilter,
  CaseFilter,
  CaseT,
  NumberFilter,
  PossessiveScope,
} from '../models/types';

const STORAGE_KEY = 'schleifer.settings';

export const ALL_ADJ_CASES: readonly CaseT[] = ['nom', 'acc', 'dat', 'gen'];

const DEFAULTS: AppSettings = {
  caseFilter: 'all',
  numberFilter: 'both',
  articleFilter: 'both',
  possessiveScope: 'off',
  adjCaseFilter: [...ALL_ADJ_CASES],
  adjNumberFilter: 'both',
  adjClassFilter: 'all',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<AppSettings>(this.load());

  setCaseFilter(v: CaseFilter) {
    this.settings.update((s) => ({ ...s, caseFilter: v }));
    this.persist();
  }

  setNumberFilter(v: NumberFilter) {
    this.settings.update((s) => ({ ...s, numberFilter: v }));
    this.persist();
  }

  setArticleFilter(v: ArticleFilter) {
    this.settings.update((s) => ({ ...s, articleFilter: v }));
    this.persist();
  }

  setPossessiveScope(v: PossessiveScope) {
    this.settings.update((s) => ({ ...s, possessiveScope: v }));
    this.persist();
  }

  /** Replace the adjective case selection. An empty selection is ignored —
   *  there must always be at least one case to drill. Stored in canonical
   *  nom/acc/dat/gen order. */
  setAdjCaseFilter(v: CaseT[]) {
    const picked = ALL_ADJ_CASES.filter((c) => v.includes(c));
    if (picked.length === 0) return;
    this.settings.update((s) => ({ ...s, adjCaseFilter: picked }));
    this.persist();
  }

  setAdjNumberFilter(v: NumberFilter) {
    this.settings.update((s) => ({ ...s, adjNumberFilter: v }));
    this.persist();
  }

  setAdjClassFilter(v: AdjClassFilter) {
    this.settings.update((s) => ({ ...s, adjClassFilter: v }));
    this.persist();
  }

  private persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings())); } catch {}
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        caseFilter: isCaseFilter(parsed.caseFilter) ? parsed.caseFilter : DEFAULTS.caseFilter,
        numberFilter: isNumberFilter(parsed.numberFilter) ? parsed.numberFilter : DEFAULTS.numberFilter,
        articleFilter: isArticleFilter(parsed.articleFilter) ? parsed.articleFilter : DEFAULTS.articleFilter,
        possessiveScope: isPossessiveScope(parsed.possessiveScope)
          ? parsed.possessiveScope
          : DEFAULTS.possessiveScope,
        adjCaseFilter: parseAdjCases(parsed.adjCaseFilter),
        adjNumberFilter: isNumberFilter(parsed.adjNumberFilter)
          ? parsed.adjNumberFilter
          : DEFAULTS.adjNumberFilter,
        adjClassFilter: isAdjClassFilter(parsed.adjClassFilter)
          ? parsed.adjClassFilter
          : DEFAULTS.adjClassFilter,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
}

// Accepts the current array form and the pre-genitive single-choice string
// ('all' | 'nom' | 'acc' | 'dat'), so an old stored 'all' now includes Genitiv.
function parseAdjCases(v: unknown): CaseT[] {
  if (Array.isArray(v)) {
    const picked = ALL_ADJ_CASES.filter((c) => v.includes(c));
    if (picked.length > 0) return picked;
  } else if (v === 'nom' || v === 'acc' || v === 'dat') {
    return [v];
  }
  return [...ALL_ADJ_CASES];
}

function isAdjClassFilter(v: unknown): v is AdjClassFilter {
  return v === 'all' || v === 'weak' || v === 'mixed' || v === 'strong';
}

function isCaseFilter(v: unknown): v is CaseFilter {
  return v === 'all' || v === 'nom' || v === 'acc' || v === 'dat';
}
function isNumberFilter(v: unknown): v is NumberFilter {
  return v === 'both' || v === 'sg' || v === 'pl';
}
function isArticleFilter(v: unknown): v is ArticleFilter {
  return v === 'both' || v === 'def' || v === 'indef';
}
function isPossessiveScope(v: unknown): v is PossessiveScope {
  return v === 'off' || v === 'basic2' || v === 'core4' || v === 'all7';
}
