import { Injectable, signal } from '@angular/core';
import {
  AppSettings,
  ArticleFilter,
  CaseFilter,
  NumberFilter,
} from '../models/types';

const STORAGE_KEY = 'schleifer.settings';

const DEFAULTS: AppSettings = {
  caseFilter: 'all',
  numberFilter: 'both',
  articleFilter: 'both',
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
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
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
