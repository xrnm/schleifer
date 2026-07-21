import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Card, Noun, NounCatalog, Rule, UserNounInput } from '../models/types';
import { generateAllCards, generateCardsForNoun } from './declension';
import { DbService } from './db.service';
import { translationCardId } from './translation';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private db = inject(DbService);

  private nouns: Noun[] = [];
  private cards: Card[] = [];
  private rules: Rule[] = [];
  private nounById = new Map<string, Noun>();
  private cardById = new Map<string, Card>();
  private ruleById = new Map<number, Rule>();
  private ready: Promise<void> | null = null;

  /** Bumped on every user-noun mutation so views can refresh reactively. */
  readonly changed = signal(0);

  init(): Promise<void> {
    if (!this.ready) this.ready = this.load();
    return this.ready;
  }

  private async load(): Promise<void> {
    const file = await firstValueFrom(
      this.http.get<NounCatalog>('assets/nouns.json'),
    );
    const storedVersion = await this.db.getMeta<string>('catalogVersion');

    // Rules live only in memory — they're small and shipped with the bundle.
    this.rules = file.rules ?? [];
    this.ruleById = new Map(this.rules.map((r) => [r.id, r]));

    let builtinNouns: Noun[];
    let builtinCards: Card[];
    if (storedVersion !== file.catalogVersion) {
      // First run or catalog upgrade: rebuild the builtin corpus. clearBuiltin
      // touches only the nouns/cards stores, so user content is untouched and
      // cards for nouns dropped by the new version don't linger.
      builtinCards = generateAllCards(file.nouns);
      await this.db.clearBuiltin();
      await this.db.putAllNouns(file.nouns);
      await this.db.putAllCards(builtinCards);
      await this.db.setMeta('catalogVersion', file.catalogVersion);
      builtinNouns = file.nouns;
    } else {
      builtinNouns = await this.db.getAllNouns();
      builtinCards = await this.db.getAllCards();
      // Defensive: if for some reason the cards got wiped, regenerate.
      if (builtinCards.length === 0 && builtinNouns.length > 0) {
        builtinCards = generateAllCards(builtinNouns);
        await this.db.putAllCards(builtinCards);
      }
    }
    for (const n of builtinNouns) n.source = 'builtin';

    // Merge in the user's custom nouns (present anonymously; synced later).
    const userNouns = await this.db.getAllUserNouns();
    let userCards = await this.db.getAllUserCards();
    // Defensive: regenerate cards for any user noun whose cards went missing.
    const cardedNounIds = new Set(userCards.map((c) => c.nounId));
    const missing = userNouns.filter((n) => !cardedNounIds.has(n.id));
    if (missing.length) {
      const regenerated = missing.flatMap((n) => generateCardsForNoun(n));
      await this.db.putUserCards(regenerated);
      userCards = [...userCards, ...regenerated];
    }
    for (const n of userNouns) n.source = 'user';

    this.nouns = [...builtinNouns, ...userNouns];
    this.cards = [...builtinCards, ...userCards];
    this.nounById = new Map(this.nouns.map((n) => [n.id, n]));
    this.cardById = new Map(this.cards.map((c) => [c.id, c]));
  }

  // --- Custom (user-added) nouns ------------------------------------------

  userNouns(): Noun[] {
    return this.nouns.filter((n) => n.source === 'user');
  }

  /** Drop all custom nouns from the in-memory union (after a store wipe). */
  dropUserNounsLocal(): void {
    const userIds = new Set(this.userNouns().map((n) => n.id));
    this.nouns = this.nouns.filter((n) => n.source !== 'user');
    this.cards = this.cards.filter((c) => !userIds.has(c.nounId));
    this.nounById = new Map(this.nouns.map((n) => [n.id, n]));
    this.cardById = new Map(this.cards.map((c) => [c.id, c]));
    this.changed.update((n) => n + 1);
  }

  async addUserNoun(input: UserNounInput): Promise<Noun> {
    const noun = this.buildUserNoun('u_' + crypto.randomUUID(), input);
    const cards = generateCardsForNoun(noun);
    await this.db.putUserNoun(noun);
    await this.db.putUserCards(cards);
    this.nouns.push(noun);
    this.nounById.set(noun.id, noun);
    for (const c of cards) {
      this.cards.push(c);
      this.cardById.set(c.id, c);
    }
    this.changed.update((n) => n + 1);
    return noun;
  }

  async updateUserNoun(id: string, input: UserNounInput): Promise<Noun> {
    const existing = this.nounById.get(id);
    if (!existing || existing.source !== 'user') {
      throw new Error('Not a user noun');
    }
    const updated = this.buildUserNoun(id, input);
    const oldCardIds = await this.db.deleteUserCardsForNoun(id);
    const newCards = generateCardsForNoun(updated);
    await this.db.putUserCards(newCards);
    await this.db.putUserNoun(updated);
    // Toggling pluralOnly/plural can drop card ids; clean their orphaned SRS.
    const newIds = new Set(newCards.map((c) => c.id));
    const removed = oldCardIds.filter((cid) => !newIds.has(cid));
    await this.db.deleteCardStatesForCards(removed);

    this.nouns = this.nouns.map((n) => (n.id === id ? updated : n));
    this.nounById.set(id, updated);
    this.cards = this.cards.filter((c) => c.nounId !== id);
    for (const cid of oldCardIds) this.cardById.delete(cid);
    for (const c of newCards) {
      this.cards.push(c);
      this.cardById.set(c.id, c);
    }
    this.changed.update((n) => n + 1);
    return updated;
  }

  async deleteUserNoun(id: string): Promise<void> {
    const existing = this.nounById.get(id);
    if (!existing || existing.source !== 'user') {
      throw new Error('Not a user noun');
    }
    const removedCardIds = await this.db.deleteUserCardsForNoun(id);
    await this.db.deleteUserNoun(id);
    // Cascade-clean SRS: declension card states plus the Vokabular one.
    await this.db.deleteCardStatesForCards([
      ...removedCardIds,
      translationCardId(id),
    ]);

    this.nouns = this.nouns.filter((n) => n.id !== id);
    this.nounById.delete(id);
    this.cards = this.cards.filter((c) => c.nounId !== id);
    for (const cid of removedCardIds) this.cardById.delete(cid);
    this.changed.update((n) => n + 1);
  }

  private buildUserNoun(id: string, input: UserNounInput): Noun {
    const plural = input.pluralOnly
      ? null
      : input.plural && input.plural.trim()
        ? input.plural.trim()
        : null;
    return {
      id,
      singular: input.singular.trim(),
      plural,
      pluralOnly: input.pluralOnly,
      gender: input.gender,
      importance: input.importance,
      english: input.english.trim(),
      source: 'user',
      updatedAt: Date.now(),
    };
  }

  /**
   * Apply a custom noun pulled from the cloud. Writes only when the remote copy
   * is newer than (or absent) locally, regenerating its cards. Does not bump
   * updatedAt — the remote timestamp is authoritative. Returns true if applied.
   */
  async applyRemoteUserNoun(noun: Noun): Promise<boolean> {
    const local = this.nounById.get(noun.id);
    if (local && (local.updatedAt ?? 0) >= (noun.updatedAt ?? 0)) return false;
    const incoming: Noun = { ...noun, source: 'user' };
    const cards = generateCardsForNoun(incoming);
    await this.db.deleteUserCardsForNoun(incoming.id);
    await this.db.putUserCards(cards);
    await this.db.putUserNoun(incoming);

    if (local) {
      this.nouns = this.nouns.map((n) => (n.id === incoming.id ? incoming : n));
      this.cards = this.cards.filter((c) => c.nounId !== incoming.id);
    } else {
      this.nouns.push(incoming);
    }
    this.nounById.set(incoming.id, incoming);
    for (const c of cards) {
      this.cards.push(c);
      this.cardById.set(c.id, c);
    }
    this.changed.update((n) => n + 1);
    return true;
  }

  allNouns(): Noun[] { return this.nouns; }
  allCards(): Card[] { return this.cards; }
  allRules(): Rule[] { return this.rules; }
  noun(id: string): Noun | undefined { return this.nounById.get(id); }
  card(id: string): Card | undefined { return this.cardById.get(id); }
  rule(id: number): Rule | undefined { return this.ruleById.get(id); }
  rulesFor(noun: Noun): Rule[] {
    if (!noun.ruleIds?.length) return [];
    return noun.ruleIds.map((id) => this.ruleById.get(id)).filter((r): r is Rule => !!r);
  }
  primaryRuleFor(noun: Noun): Rule | undefined {
    if (noun.primaryRuleId !== undefined) {
      const r = this.ruleById.get(noun.primaryRuleId);
      if (r) return r;
    }
    return this.rulesFor(noun)[0];
  }
  nounsForRule(ruleId: number): Noun[] {
    return this.nouns.filter((n) => n.ruleIds?.includes(ruleId));
  }
}
