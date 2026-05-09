import { Injectable, inject } from '@angular/core';
import { Card, CardState } from '../models/types';
import { CatalogService } from './catalog.service';
import { DbService } from './db.service';

const RECENT_FAIL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEW_CAP = 35;
const RECENT_FAIL_CAP = 10;
const MAX_PER_NOUN = 2;

@Injectable({ providedIn: 'root' })
export class SelectorService {
  private db = inject(DbService);
  private catalog = inject(CatalogService);

  async pickSession(targetCount: number, now = Date.now()): Promise<Card[]> {
    const states = await this.db.getAllCardStates();
    const stateById = new Map(states.map((s) => [s.cardId, s]));

    const allCards = this.catalog.allCards();
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
