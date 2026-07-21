import { Injectable } from '@angular/core';
import { IDBPDatabase, IDBPTransaction, openDB } from 'idb';
import {
  ActivityEvent,
  Card,
  CardState,
  Noun,
  Session,
  StoredEvent,
} from '../models/types';

const DB_NAME = 'schleifer';
// v2: userNouns / userCards stores for custom nouns (kept separate so a corpus
//     upgrade never touches user content).
// v3: cloud-sync support — events move from an auto-increment numeric id to a
//     stable string id (so they dedupe across devices), cardStates/sessions get
//     a backfilled updatedAt, and a syncQueue store tracks dirty rows.
const DB_VERSION = 3;

// A pending-upload marker. key = `${store}::${pk}`.
export interface DirtyRow {
  key: string;
  store: 'cardStates' | 'sessions' | 'events';
  pk: string;
  updatedAt: number;
}

interface MetaRow {
  key: string;
  value: unknown;
}

@Injectable({ providedIn: 'root' })
export class DbService {
  private dbp: Promise<IDBPDatabase> | null = null;

  /**
   * When true, local writes enqueue a dirty marker for the sync layer. Left
   * false for anonymous users so the syncQueue never grows for someone who
   * never signs in. SyncService flips this on once a session exists.
   */
  syncActive = false;

  private db(): Promise<IDBPDatabase> {
    if (!this.dbp) {
      this.dbp = openDB(DB_NAME, DB_VERSION, {
        async upgrade(db, oldVersion, _newVersion, tx) {
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
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
          // v2 stores.
          if (!db.objectStoreNames.contains('userNouns')) {
            db.createObjectStore('userNouns', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('userCards')) {
            const uc = db.createObjectStore('userCards', { keyPath: 'id' });
            uc.createIndex('nounId', 'nounId');
          }
          // v3 sync queue.
          if (!db.objectStoreNames.contains('syncQueue')) {
            db.createObjectStore('syncQueue', { keyPath: 'key' });
          }
          // v3 events store: string keyPath. Fresh installs get it directly;
          // an existing auto-increment store is drained and recreated (keyPath
          // can't be changed in place), assigning uuids to legacy rows.
          const makeEvents = () => {
            const e = db.createObjectStore('events', { keyPath: 'id' });
            e.createIndex('ts', 'ts');
            e.createIndex('kind', 'kind');
            e.createIndex('sessionId', 'sessionId');
            return e;
          };
          if (!db.objectStoreNames.contains('events')) {
            makeEvents();
          } else if (oldVersion < 3) {
            const legacy = (await tx.objectStore('events').getAll()) as Record<
              string,
              unknown
            >[];
            db.deleteObjectStore('events');
            const e = makeEvents();
            for (const ev of legacy) {
              if (typeof ev['id'] !== 'string') ev['id'] = crypto.randomUUID();
              await e.put(ev);
            }
          }
          // v3: backfill updatedAt on existing progress rows.
          if (oldVersion >= 1 && oldVersion < 3) {
            await backfillUpdatedAt(tx, 'cardStates', (v) => v['lastShownAt']);
            await backfillUpdatedAt(tx, 'sessions', (v) => v['startedAt']);
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

  /**
   * Clears the builtin corpus stores only. Safe to call on a catalog upgrade
   * because user content lives in the separate userNouns / userCards stores.
   * Clearing (rather than blind put) also drops cards for nouns a new catalog
   * version removed.
   */
  async clearBuiltin(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['nouns', 'cards'], 'readwrite');
    await Promise.all([
      tx.objectStore('nouns').clear(),
      tx.objectStore('cards').clear(),
      tx.done,
    ]);
  }

  // --- Custom (user-added) nouns ------------------------------------------

  async getAllUserNouns(): Promise<Noun[]> {
    const db = await this.db();
    return (await db.getAll('userNouns')) as Noun[];
  }

  async putUserNoun(noun: Noun): Promise<void> {
    const db = await this.db();
    await db.put('userNouns', noun);
  }

  async deleteUserNoun(id: string): Promise<void> {
    const db = await this.db();
    await db.delete('userNouns', id);
  }

  /** Wipe all custom nouns + their cards (used on account switch). */
  async clearUserNouns(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['userNouns', 'userCards'], 'readwrite');
    await Promise.all([
      tx.objectStore('userNouns').clear(),
      tx.objectStore('userCards').clear(),
      tx.done,
    ]);
  }

  async getAllUserCards(): Promise<Card[]> {
    const db = await this.db();
    return (await db.getAll('userCards')) as Card[];
  }

  async putUserCards(cards: Card[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('userCards', 'readwrite');
    for (const c of cards) tx.store.put(c);
    await tx.done;
  }

  async deleteUserCardsForNoun(nounId: string): Promise<string[]> {
    const db = await this.db();
    const tx = db.transaction('userCards', 'readwrite');
    const idx = tx.store.index('nounId');
    const deleted: string[] = [];
    let cursor = await idx.openCursor(nounId);
    while (cursor) {
      deleted.push(cursor.primaryKey as string);
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
    return deleted;
  }

  /** Cascade cleanup: drop SRS state for card ids that no longer exist. */
  async deleteCardStatesForCards(cardIds: string[]): Promise<void> {
    if (!cardIds.length) return;
    const db = await this.db();
    const tx = db.transaction('cardStates', 'readwrite');
    for (const id of cardIds) await tx.store.delete(id);
    await tx.done;
  }

  async getCardState(cardId: string): Promise<CardState | undefined> {
    const db = await this.db();
    return (await db.get('cardStates', cardId)) as CardState | undefined;
  }

  async putCardState(state: CardState): Promise<void> {
    const db = await this.db();
    state.updatedAt = Date.now();
    await db.put('cardStates', state);
    await this.markDirty('cardStates', state.cardId, state.updatedAt);
  }

  async getAllCardStates(): Promise<CardState[]> {
    const db = await this.db();
    return (await db.getAll('cardStates')) as CardState[];
  }

  async putSession(s: Session): Promise<void> {
    const db = await this.db();
    s.updatedAt = Date.now();
    await db.put('sessions', s);
    await this.markDirty('sessions', s.id, s.updatedAt);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const db = await this.db();
    return (await db.get('sessions', id)) as Session | undefined;
  }

  async getAllSessions(): Promise<Session[]> {
    const db = await this.db();
    return (await db.getAll('sessions')) as Session[];
  }

  async addEvent(ev: ActivityEvent | StoredEvent): Promise<StoredEvent> {
    const db = await this.db();
    const stored = { ...(ev as StoredEvent) };
    if (typeof stored.id !== 'string') stored.id = crypto.randomUUID();
    await db.put('events', stored);
    await this.markDirty('events', stored.id, stored.ts);
    return stored;
  }

  async getAllEvents(): Promise<StoredEvent[]> {
    const db = await this.db();
    return (await db.getAll('events')) as StoredEvent[];
  }

  async getEventsBySession(sessionId: string): Promise<StoredEvent[]> {
    const db = await this.db();
    const idx = db.transaction('events').store.index('sessionId');
    const rows = (await idx.getAll(sessionId)) as StoredEvent[];
    // Events carry monotonic ts within a session; use it for display order.
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }

  async clearUserData(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(
      ['cardStates', 'sessions', 'events', 'syncQueue'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('cardStates').clear(),
      tx.objectStore('sessions').clear(),
      tx.objectStore('events').clear(),
      tx.objectStore('syncQueue').clear(),
      tx.done,
    ]);
  }

  async bulkPut(
    store: 'cardStates' | 'sessions',
    rows: (CardState | Session)[],
  ): Promise<void> {
    const db = await this.db();
    const now = Date.now();
    const tx = db.transaction(store, 'readwrite');
    for (const r of rows) {
      if (r.updatedAt == null) r.updatedAt = now;
      tx.store.put(r);
    }
    await tx.done;
  }

  async bulkAddEvents(
    rows: (ActivityEvent & { id?: string | number })[],
  ): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('events', 'readwrite');
    for (const r of rows) {
      const stored = { ...r } as StoredEvent;
      if (typeof stored.id !== 'string') stored.id = crypto.randomUUID();
      tx.store.put(stored);
    }
    await tx.done;
  }

  // --- Cloud-sync support -------------------------------------------------

  private async markDirty(
    store: DirtyRow['store'],
    pk: string,
    updatedAt: number,
  ): Promise<void> {
    if (!this.syncActive) return;
    const db = await this.db();
    await db.put('syncQueue', {
      key: `${store}::${pk}`,
      store,
      pk,
      updatedAt,
    } satisfies DirtyRow);
  }

  async getDirty(): Promise<DirtyRow[]> {
    const db = await this.db();
    return (await db.getAll('syncQueue')) as DirtyRow[];
  }

  async clearDirty(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const db = await this.db();
    const tx = db.transaction('syncQueue', 'readwrite');
    for (const k of keys) tx.store.delete(k);
    await tx.done;
  }

  /** Enqueue every local progress row as dirty — used to seed the first push. */
  async markAllDirty(): Promise<void> {
    const [states, sessions, events] = await Promise.all([
      this.getAllCardStates(),
      this.getAllSessions(),
      this.getAllEvents(),
    ]);
    const db = await this.db();
    const tx = db.transaction('syncQueue', 'readwrite');
    for (const s of states)
      tx.store.put({
        key: `cardStates::${s.cardId}`,
        store: 'cardStates',
        pk: s.cardId,
        updatedAt: s.updatedAt ?? Date.now(),
      } satisfies DirtyRow);
    for (const s of sessions)
      tx.store.put({
        key: `sessions::${s.id}`,
        store: 'sessions',
        pk: s.id,
        updatedAt: s.updatedAt ?? Date.now(),
      } satisfies DirtyRow);
    for (const e of events)
      tx.store.put({
        key: `events::${e.id}`,
        store: 'events',
        pk: e.id,
        updatedAt: e.ts,
      } satisfies DirtyRow);
    await tx.done;
  }

  /** Read one row by primary key from a syncable store. */
  async getRow(
    store: 'cardStates' | 'sessions' | 'events',
    pk: string,
  ): Promise<unknown> {
    const db = await this.db();
    return db.get(store, pk);
  }

  /** Write a row from a remote pull — no stamping, no dirty marker. */
  async putRow(
    store: 'cardStates' | 'sessions' | 'events',
    row: unknown,
  ): Promise<void> {
    const db = await this.db();
    await db.put(store, row);
  }

  async counts(): Promise<Record<string, number>> {
    const db = await this.db();
    return {
      nouns: await db.count('nouns'),
      cards: await db.count('cards'),
      cardStates: await db.count('cardStates'),
      sessions: await db.count('sessions'),
      events: await db.count('events'),
      userNouns: await db.count('userNouns'),
      userCards: await db.count('userCards'),
    };
  }
}

/** Backfill an `updatedAt` on rows that predate it (v3 migration). */
async function backfillUpdatedAt(
  tx: IDBPTransaction<unknown, string[], 'versionchange'>,
  store: string,
  fallback: (v: Record<string, number | null>) => number | null,
): Promise<void> {
  const now = Date.now();
  let cursor = await tx.objectStore(store).openCursor();
  while (cursor) {
    const v = cursor.value as Record<string, number | null>;
    if (v['updatedAt'] == null) {
      v['updatedAt'] = fallback(v) ?? now;
      await cursor.update(v);
    }
    cursor = await cursor.continue();
  }
}
