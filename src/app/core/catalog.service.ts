import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Card, Noun, NounCatalog, Rule } from '../models/types';
import { generateAllCards } from './declension';
import { DbService } from './db.service';

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

    if (storedVersion !== file.catalogVersion) {
      // First run or catalog upgrade: rebuild nouns + cards.
      const cards = generateAllCards(file.nouns);
      await this.db.putAllNouns(file.nouns);
      await this.db.putAllCards(cards);
      await this.db.setMeta('catalogVersion', file.catalogVersion);
      this.nouns = file.nouns;
      this.cards = cards;
    } else {
      this.nouns = await this.db.getAllNouns();
      this.cards = await this.db.getAllCards();
      // Defensive: if for some reason the cards got wiped, regenerate.
      if (this.cards.length === 0 && this.nouns.length > 0) {
        this.cards = generateAllCards(this.nouns);
        await this.db.putAllCards(this.cards);
      }
    }
    this.nounById = new Map(this.nouns.map((n) => [n.id, n]));
    this.cardById = new Map(this.cards.map((c) => [c.id, c]));
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
