import { Injectable } from '@angular/core';
import { IDBPDatabase, openDB } from 'idb';
import {
  ActivityEvent,
  Card,
  CardState,
  Noun,
  Session,
} from '../models/types';

const DB_NAME = 'schleifer';
const DB_VERSION = 1;

interface MetaRow {
  key: string;
  value: unknown;
}

@Injectable({ providedIn: 'root' })
export class DbService {
  private dbp: Promise<IDBPDatabase> | null = null;

  private db(): Promise<IDBPDatabase> {
    if (!this.dbp) {
      this.dbp = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('nouns')) {
            db.createObjectStore('nouns', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('cards')) {
            db.createObjectStore('cards', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('cardStates')) {
            db.createObjectStore('cardStates', { keyPath: 'cardId' });
          }
          if (!db.objectStoreNames.contains('sessions')) {
            const s = db.createObjectStore('sessions', { keyPath: 'id' });
            s.createIndex('startedAt', 'startedAt');
          }
          if (!db.objectStoreNames.contains('events')) {
            const e = db.createObjectStore('events', {
              keyPath: 'id',
              autoIncrement: true,
            });
            e.createIndex('ts', 'ts');
            e.createIndex('kind', 'kind');
            e.createIndex('sessionId', 'sessionId');
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
        },
      });
    }
    return this.dbp;
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const db = await this.db();
    const row = (await db.get('meta', key)) as MetaRow | undefined;
    return row?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await this.db();
    await db.put('meta', { key, value });
  }

  async putAllNouns(nouns: Noun[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('nouns', 'readwrite');
    for (const n of nouns) tx.store.put(n);
    await tx.done;
  }

  async getAllNouns(): Promise<Noun[]> {
    const db = await this.db();
    return (await db.getAll('nouns')) as Noun[];
  }

  async putAllCards(cards: Card[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('cards', 'readwrite');
    for (const c of cards) tx.store.put(c);
    await tx.done;
  }

  async getAllCards(): Promise<Card[]> {
    const db = await this.db();
    return (await db.getAll('cards')) as Card[];
  }

  async getCard(id: string): Promise<Card | undefined> {
    const db = await this.db();
    return (await db.get('cards', id)) as Card | undefined;
  }

  async getNoun(id: string): Promise<Noun | undefined> {
    const db = await this.db();
    return (await db.get('nouns', id)) as Noun | undefined;
  }

  async getCardState(cardId: string): Promise<CardState | undefined> {
    const db = await this.db();
    return (await db.get('cardStates', cardId)) as CardState | undefined;
  }

  async putCardState(state: CardState): Promise<void> {
    const db = await this.db();
    await db.put('cardStates', state);
  }

  async getAllCardStates(): Promise<CardState[]> {
    const db = await this.db();
    return (await db.getAll('cardStates')) as CardState[];
  }

  async putSession(s: Session): Promise<void> {
    const db = await this.db();
    await db.put('sessions', s);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const db = await this.db();
    return (await db.get('sessions', id)) as Session | undefined;
  }

  async getAllSessions(): Promise<Session[]> {
    const db = await this.db();
    return (await db.getAll('sessions')) as Session[];
  }

  async addEvent(ev: ActivityEvent): Promise<void> {
    const db = await this.db();
    await db.add('events', ev as any);
  }

  async getAllEvents(): Promise<(ActivityEvent & { id?: number })[]> {
    const db = await this.db();
    return (await db.getAll('events')) as (ActivityEvent & { id?: number })[];
  }

  async getEventsBySession(
    sessionId: string,
  ): Promise<(ActivityEvent & { id?: number })[]> {
    const db = await this.db();
    const idx = db.transaction('events').store.index('sessionId');
    const rows = (await idx.getAll(sessionId)) as (ActivityEvent & {
      id?: number;
    })[];
    rows.sort((a, b) => ((a as any).id ?? 0) - ((b as any).id ?? 0));
    return rows;
  }

  async clearUserData(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(
      ['cardStates', 'sessions', 'events'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('cardStates').clear(),
      tx.objectStore('sessions').clear(),
      tx.objectStore('events').clear(),
      tx.done,
    ]);
  }

  async bulkPut<T>(store: 'cardStates' | 'sessions', rows: T[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(store, 'readwrite');
    for (const r of rows) tx.store.put(r as any);
    await tx.done;
  }

  async bulkAddEvents(rows: ActivityEvent[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('events', 'readwrite');
    for (const r of rows) {
      const { ...payload } = r as ActivityEvent & { id?: number };
      delete (payload as any).id;
      tx.store.add(payload as any);
    }
    await tx.done;
  }

  async counts(): Promise<Record<string, number>> {
    const db = await this.db();
    return {
      nouns: await db.count('nouns'),
      cards: await db.count('cards'),
      cardStates: await db.count('cardStates'),
      sessions: await db.count('sessions'),
      events: await db.count('events'),
    };
  }
}
