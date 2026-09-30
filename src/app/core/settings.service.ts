import { Injectable, signal } from '@angular/core';
import {
  AdjClassFilter,
  AppSettings,
  ArticleFilter,
  CaseFilter,
  NumberFilter,
  PossessiveScope,
} from '../models/types';

const STORAGE_KEY = 'schleifer.settings';

const DEFAULTS: AppSettings = {
  caseFilter: 'all',
  numberFilter: 'both',
  articleFilter: 'both',
  possessiveScope: 'off',
  adjCaseFilter: 'all',
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

  setAdjCaseFilter(v: CaseFilter) {
    this.settings.update((s) => ({ ...s, adjCaseFilter: v }));
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
        adjCaseFilter: isCaseFilter(parsed.adjCaseFilter)
          ? parsed.adjCaseFilter
          : DEFAULTS.adjCaseFilter,
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
