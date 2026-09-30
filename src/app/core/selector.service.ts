import { Injectable, inject } from '@angular/core';
import {
  AppSettings,
  Card,
  CardState,
  Noun,
  PossessiveScope,
  PossessiveStem,
} from '../models/types';
import { CatalogService } from './catalog.service';
import { DbService } from './db.service';
import { SettingsService } from './settings.service';
import { isTranslationCardId, translationCardId } from './translation';
import { AdjCell, adjCellId, allAdjCells, isAdjectiveCardId } from './adjective';

const RECENT_FAIL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEW_CAP = 35;
const RECENT_FAIL_CAP = 10;
const MAX_PER_NOUN = 2;

export type PracticeArea = 'deklination' | 'vokabular' | 'adjektiv';

/**
 * Translation IDs are flat — one per noun. Used to mock a "card list" for the
 * vocab selector even though we don't store translation cards in IndexedDB.
 */
interface TranslationCard {
  id: string;
  nounId: string;
}

@Injectable({ providedIn: 'root' })
export class SelectorService {
  private db = inject(DbService);
  private catalog = inject(CatalogService);
  private settings = inject(SettingsService);

  /**
   * Backwards-compatible default — declension area, current filter settings.
   */
  async pickSession(targetCount: number, now = Date.now()): Promise<Card[]> {
    return this.pickDeklinationSession(targetCount, this.settings.settings(), now);
  }

  async pickDeklinationSession(
    targetCount: number,
    filters: AppSettings,
    now = Date.now(),
  ): Promise<Card[]> {
    const states = await this.db.getAllCardStates();
    const allCards = this.catalog.allCards().filter((c) => matchesFilters(c, filters));
    const cardById = new Map(allCards.map((c) => [c.id, c]));
    const nounById = new Map(this.catalog.allNouns().map((n) => [n.id, n]));

    const reviewQueue: { card: Card; state: CardState }[] = [];
    const recentFailQueue: { card: Card; state: CardState }[] = [];
    const seenCardIds = new Set<string>();

    for (const s of states) {
      const card = cardById.get(s.cardId);
      if (!card) continue;
      seenCardIds.add(s.cardId);
      if (s.lastResult !== null && s.due <= now) {
        reviewQueue.push({ card, state: s });
      } else if (
        (s.lastResult === 'incorrect' || s.lastResult === 'idk') &&
        s.lastShownAt !== null &&
        now - s.lastShownAt <= RECENT_FAIL_WINDOW_MS
      ) {
        recentFailQueue.push({ card, state: s });
      }
    }
    reviewQueue.sort((a, b) => a.state.due - b.state.due);
    recentFailQueue.sort(
      (a, b) => (b.state.lastShownAt ?? 0) - (a.state.lastShownAt ?? 0),
    );

    const picked: Card[] = [];
    const perNoun = new Map<string, number>();

    const tryPush = (card: Card): boolean => {
      const used = perNoun.get(card.nounId) ?? 0;
      if (used >= MAX_PER_NOUN) return false;
      if (picked.find((p) => p.id === card.id)) return false;
      picked.push(card);
      perNoun.set(card.nounId, used + 1);
      return true;
    };

    for (const { card } of reviewQueue) {
      if (picked.length >= targetCount || picked.length >= REVIEW_CAP) break;
      tryPush(card);
    }
    const reviewSlot = picked.length;

    for (const { card } of recentFailQueue) {
      if (picked.length >= targetCount) break;
      if (picked.length - reviewSlot >= RECENT_FAIL_CAP) break;
      tryPush(card);
    }

    if (picked.length < targetCount) {
      const newPool = allCards.filter((c) => !seenCardIds.has(c.id));
      const weighted: { card: Card; weight: number }[] = newPool.map((c) => {
        const noun = nounById.get(c.nounId);
        return { card: c, weight: Math.max(1, noun?.importance ?? 1) };
      });
      while (picked.length < targetCount && weighted.length > 0) {
        const total = weighted.reduce((acc, w) => acc + w.weight, 0);
        if (total <= 0) break;
        let r = Math.random() * total;
        let idx = 0;
        for (; idx < weighted.length; idx++) {
          r -= weighted[idx].weight;
          if (r <= 0) break;
        }
        const chosen = weighted.splice(Math.min(idx, weighted.length - 1), 1)[0];
        if (!tryPush(chosen.card)) {
          // capacity hit for that noun; just continue
        }
      }
    }

    return shuffleAvoidingAdjacent(picked);
  }

  /**
   * Returns the synthetic translation cards (one per noun) that should be
   * presented this session, in display order. Card IDs use the
   * `${nounId}|translation` form and live in the same CardState store.
   */
  async pickVokabularSession(
    targetCount: number,
    now = Date.now(),
  ): Promise<TranslationCard[]> {
    const states = await this.db.getAllCardStates();
    const nouns = this.catalog.allNouns().filter((n) => !!n.english);
    const idByNoun = new Map(nouns.map((n) => [n.id, translationCardId(n.id)]));
    const nounByTransId = new Map(nouns.map((n) => [translationCardId(n.id), n]));

    const reviewQueue: { noun: Noun; state: CardState }[] = [];
    const recentFailQueue: { noun: Noun; state: CardState }[] = [];
    const seenIds = new Set<string>();

    for (const s of states) {
      if (!isTranslationCardId(s.cardId)) continue;
      const noun = nounByTransId.get(s.cardId);
      if (!noun) continue;
      seenIds.add(s.cardId);
      if (s.lastResult !== null && s.due <= now) {
        reviewQueue.push({ noun, state: s });
      } else if (
        (s.lastResult === 'incorrect' || s.lastResult === 'idk') &&
        s.lastShownAt !== null &&
        now - s.lastShownAt <= RECENT_FAIL_WINDOW_MS
      ) {
        recentFailQueue.push({ noun, state: s });
      }
    }
    reviewQueue.sort((a, b) => a.state.due - b.state.due);
    recentFailQueue.sort(
      (a, b) => (b.state.lastShownAt ?? 0) - (a.state.lastShownAt ?? 0),
    );

    const picked: TranslationCard[] = [];
    const pushed = new Set<string>();
    const push = (noun: Noun): boolean => {
      const id = idByNoun.get(noun.id);
      if (!id || pushed.has(id)) return false;
      picked.push({ id, nounId: noun.id });
      pushed.add(id);
      return true;
    };

    for (const { noun } of reviewQueue) {
      if (picked.length >= targetCount || picked.length >= REVIEW_CAP) break;
      push(noun);
    }
    const reviewSlot = picked.length;

    for (const { noun } of recentFailQueue) {
      if (picked.length >= targetCount) break;
      if (picked.length - reviewSlot >= RECENT_FAIL_CAP) break;
      push(noun);
    }

    if (picked.length < targetCount) {
      const unseen = nouns.filter((n) => !seenIds.has(translationCardId(n.id)));
      const weighted = unseen.map((n) => ({ noun: n, weight: Math.max(1, n.importance) }));
      while (picked.length < targetCount && weighted.length > 0) {
        const total = weighted.reduce((acc, w) => acc + w.weight, 0);
        if (total <= 0) break;
        let r = Math.random() * total;
        let idx = 0;
        for (; idx < weighted.length; idx++) {
          r -= weighted[idx].weight;
          if (r <= 0) break;
        }
        const chosen = weighted.splice(Math.min(idx, weighted.length - 1), 1)[0];
        push(chosen.noun);
      }
    }

    // No adjacency rule needed — translation cards are one-per-noun.
    return picked;
  }

  /**
   * Returns the adjective ending-cell ids to present this session, ordered
   * review → recent-fail → new. The universe is the 36 cells (filtered by the
   * adjective drawer); each cell is one SRS card in the shared cardStates
   * store. The surface (which adjective/noun) is chosen at render time.
   */
  async pickAdjektivSession(
    targetCount: number,
    filters: AppSettings,
    now = Date.now(),
  ): Promise<string[]> {
    const states = await this.db.getAllCardStates();
    const ids = allowedAdjCellIds(filters);
    const stateById = new Map(
      states.filter((s) => isAdjectiveCardId(s.cardId)).map((s) => [s.cardId, s]),
    );

    const reviewQueue: { id: string; state: CardState }[] = [];
    const recentFailQueue: { id: string; state: CardState }[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      const s = stateById.get(id);
      if (!s) continue;
      seen.add(id);
      if (s.lastResult !== null && s.due <= now) {
        reviewQueue.push({ id, state: s });
      } else if (
        (s.lastResult === 'incorrect' || s.lastResult === 'idk') &&
        s.lastShownAt !== null &&
        now - s.lastShownAt <= RECENT_FAIL_WINDOW_MS
      ) {
        recentFailQueue.push({ id, state: s });
      }
    }
    reviewQueue.sort((a, b) => a.state.due - b.state.due);
    recentFailQueue.sort(
      (a, b) => (b.state.lastShownAt ?? 0) - (a.state.lastShownAt ?? 0),
    );

    const picked: string[] = [];
    const pushed = new Set<string>();
    const push = (id: string) => {
      if (pushed.has(id)) return;
      picked.push(id);
      pushed.add(id);
    };

    for (const { id } of reviewQueue) {
      if (picked.length >= targetCount || picked.length >= REVIEW_CAP) break;
      push(id);
    }
    const reviewSlot = picked.length;
    for (const { id } of recentFailQueue) {
      if (picked.length >= targetCount) break;
      if (picked.length - reviewSlot >= RECENT_FAIL_CAP) break;
      push(id);
    }
    if (picked.length < targetCount) {
      const fresh = ids.filter((id) => !seen.has(id));
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
      }
      for (const id of fresh) {
        if (picked.length >= targetCount) break;
        push(id);
      }
    }
    return picked;
  }

  /**
   * Number of cards currently due for an area, given the current filters
   * (filters only apply to declension). "Due" matches the same condition
   * pickSession() uses: a card with a recorded result whose `due` has passed.
   */
  async dueCount(area: PracticeArea, now = Date.now()): Promise<number> {
    const states = await this.db.getAllCardStates();
    if (area === 'vokabular') {
      return states.filter(
        (s) => isTranslationCardId(s.cardId) && s.lastResult !== null && s.due <= now,
      ).length;
    }
    if (area === 'adjektiv') {
      const allowed = new Set(allowedAdjCellIds(this.settings.settings()));
      return states.filter(
        (s) => allowed.has(s.cardId) && s.lastResult !== null && s.due <= now,
      ).length;
    }
    const filters = this.settings.settings();
    const cardById = new Map(this.catalog.allCards().map((c) => [c.id, c]));
    return states.filter((s) => {
      if (s.lastResult === null || s.due > now) return false;
      const card = cardById.get(s.cardId);
      return !!card && matchesFilters(card, filters);
    }).length;
  }

  /**
   * Returns the IDs of cards currently due for the given area, ordered by
   * earliest-due first. Used by the "Drill due now" shortcut on home pages.
   */
  async dueCardIds(area: PracticeArea, now = Date.now()): Promise<string[]> {
    const states = await this.db.getAllCardStates();
    if (area === 'vokabular') {
      return states
        .filter(
          (s) => isTranslationCardId(s.cardId) && s.lastResult !== null && s.due <= now,
        )
        .sort((a, b) => a.due - b.due)
        .map((s) => s.cardId);
    }
    if (area === 'adjektiv') {
      const allowed = new Set(allowedAdjCellIds(this.settings.settings()));
      return states
        .filter((s) => allowed.has(s.cardId) && s.lastResult !== null && s.due <= now)
        .sort((a, b) => a.due - b.due)
        .map((s) => s.cardId);
    }
    const filters = this.settings.settings();
    const cardById = new Map(this.catalog.allCards().map((c) => [c.id, c]));
    return states
      .filter((s) => {
        if (s.lastResult === null || s.due > now) return false;
        const card = cardById.get(s.cardId);
        return !!card && matchesFilters(card, filters);
      })
      .sort((a, b) => a.due - b.due)
      .map((s) => s.cardId);
  }
}

function matchesAdjFilters(cell: AdjCell, f: AppSettings): boolean {
  if (f.adjCaseFilter !== 'all' && cell.case !== f.adjCaseFilter) return false;
  if (f.adjNumberFilter !== 'both' && cell.number !== f.adjNumberFilter) return false;
  if (f.adjClassFilter !== 'all' && cell.cls !== f.adjClassFilter) return false;
  return true;
}

/** The adjective ending-cell ids allowed by the current drawer filters. One
 *  source of truth for session selection and the due-count/-ids queries. */
function allowedAdjCellIds(f: AppSettings): string[] {
  return allAdjCells()
    .filter((c) => matchesAdjFilters(c, f))
    .map((c) => adjCellId(c));
}

function matchesFilters(card: Card, f: AppSettings): boolean {
  if (f.caseFilter !== 'all' && card.case !== f.caseFilter) return false;
  if (f.numberFilter !== 'both' && card.number !== f.numberFilter) return false;
  if (card.articleType === 'poss') {
    // Possessive cards live behind their own scope knob, independent of the
    // def/indef article filter.
    if (!card.possessive) return false;
    return stemInScope(card.possessive, f.possessiveScope);
  }
  if (f.articleFilter !== 'both' && card.articleType !== f.articleFilter) return false;
  return true;
}

function stemInScope(stem: PossessiveStem, scope: PossessiveScope): boolean {
  switch (scope) {
    case 'off': return false;
    case 'basic2': return stem === 'mein' || stem === 'dein';
    case 'core4':
      return stem === 'mein' || stem === 'dein' || stem === 'sein' || stem === 'ihr';
    case 'all7': return true;
  }
}

function shuffleAvoidingAdjacent(cards: Card[]): Card[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].nounId === arr[i - 1].nounId) {
      const swap = arr.findIndex(
        (c, k) =>
          k !== i &&
          k !== i - 1 &&
          c.nounId !== arr[i - 1].nounId &&
          (k + 1 >= arr.length || arr[k + 1].nounId !== arr[i].nounId) &&
          (k - 1 < 0 || arr[k - 1].nounId !== arr[i].nounId),
      );
      if (swap >= 0) {
        [arr[i], arr[swap]] = [arr[swap], arr[i]];
      }
    }
  }
  return arr;
}
