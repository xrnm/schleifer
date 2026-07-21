import { Injectable, effect, inject, signal } from '@angular/core';
import { CardState, Noun, Session, StoredEvent } from '../models/types';
import { AuthService } from './auth.service';
import { CatalogService } from './catalog.service';
import { DbService, DirtyRow } from './db.service';
import { supabase } from './supabase.client';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

// A syncable progress store and the row mapping to/from its remote table.
interface SyncTable {
  store: 'cardStates' | 'sessions' | 'events';
  remote: string;
  lww: boolean; // false => append-only, insert-if-absent (events)
  toRemote: (row: any, userId: string) => Record<string, unknown>;
  fromRemote: (r: any) => any;
}

const PERIODIC_MS = 30_000;
const CHUNK = 400;

@Injectable({ providedIn: 'root' })
export class SyncService {
  private db = inject(DbService);
  private auth = inject(AuthService);
  private catalog = inject(CatalogService);

  readonly status = signal<SyncStatus>('idle');
  readonly lastSyncedAt = signal<number | null>(null);
  readonly lastError = signal<string | null>(null);

  private activeUserId: string | null = null;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly tables: SyncTable[] = [
    {
      store: 'cardStates',
      remote: 'card_states',
      lww: true,
      toRemote: (r: CardState, userId) => ({
        user_id: userId,
        card_id: r.cardId,
        ease: r.ease,
        interval_days: r.intervalDays,
        reps: r.reps,
        due: r.due,
        lapses: r.lapses,
        last_shown_at: r.lastShownAt,
        last_result: r.lastResult,
        client_updated_at: r.updatedAt ?? Date.now(),
      }),
      fromRemote: (r): CardState => ({
        cardId: r.card_id,
        ease: r.ease,
        intervalDays: r.interval_days,
        reps: r.reps,
        due: r.due,
        lapses: r.lapses,
        lastShownAt: r.last_shown_at,
        lastResult: r.last_result,
        updatedAt: r.client_updated_at,
      }),
    },
    {
      store: 'sessions',
      remote: 'sessions',
      lww: true,
      toRemote: (r: Session, userId) => ({
        user_id: userId,
        id: r.id,
        started_at: r.startedAt,
        ended_at: r.endedAt,
        target_count: r.targetCount,
        presented: r.presented,
        correct: r.correct,
        incorrect: r.incorrect,
        idk: r.idk,
        skipped: r.skipped,
        client_updated_at: r.updatedAt ?? Date.now(),
      }),
      fromRemote: (r): Session => ({
        id: r.id,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        targetCount: r.target_count,
        presented: r.presented,
        correct: r.correct,
        incorrect: r.incorrect,
        idk: r.idk,
        skipped: r.skipped,
        updatedAt: r.client_updated_at,
      }),
    },
    {
      store: 'events',
      remote: 'events',
      lww: false,
      toRemote: (e: StoredEvent, userId) => ({
        user_id: userId,
        id: e.id,
        kind: e.kind,
        ts: e.ts,
        session_id: (e as { sessionId?: string }).sessionId ?? null,
        payload: e,
      }),
      fromRemote: (r): StoredEvent => ({ ...r.payload, id: r.id }),
    },
  ];

  // Wire auth transitions + resume/reconnect triggers. Runs in the constructor
  // so the effect() has an injection context.
  constructor() {
    effect(() => {
      const uid = this.auth.userId();
      const status = this.auth.status();
      if (status === 'loading') return;
      if (uid && uid !== this.activeUserId) {
        this.activeUserId = uid;
        void this.onLogin(uid);
      } else if (!uid && this.activeUserId) {
        this.activeUserId = null;
        this.onLogout();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.trigger());
      // Flush on BOTH transitions: on hide so leaving the tab pushes pending
      // changes promptly (before they'd wait for the next interval), and on
      // show so a returning tab pulls anything new from other devices.
      document.addEventListener('visibilitychange', () => this.trigger());
      // pagehide is the most reliable "leaving" signal on mobile.
      window.addEventListener('pagehide', () => this.trigger());
      this.timer = setInterval(() => this.trigger(), PERIODIC_MS);
    }
  }

  /** Manual "Sync now". Throws on error so the UI can surface it. */
  async syncNow(): Promise<void> {
    await this.runCycle(true);
  }

  private trigger(): void {
    void this.runCycle(false);
  }

  private online(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine;
  }

  private async onLogin(userId: string): Promise<void> {
    this.db.syncActive = true;
    const prevOwner = await this.db.getMeta<string>('sync.ownerUserId');
    if (prevOwner && prevOwner !== userId) {
      // Different account on this device — never merge one user's data into
      // another. Drop the previous user's local data before pulling.
      await this.db.clearUserData();
      await this.db.clearUserNouns();
      this.catalog.dropUserNounsLocal();
      await this.db.setMeta('sync.eventsWatermark', 0);
    }
    await this.db.setMeta('sync.ownerUserId', userId);
    // Seed: mark all local progress dirty so anonymous work uploads on first
    // login (idempotent for a returning user).
    await this.db.markAllDirty();
    await this.runCycle(true).catch(() => {});
  }

  private onLogout(): void {
    // Stop enqueuing so a now-anonymous user's queue can't grow unbounded; a
    // later login re-seeds everything. Local data is left intact for offline use.
    this.db.syncActive = false;
    this.status.set('idle');
  }

  private async runCycle(manual: boolean): Promise<void> {
    if (this.auth.status() !== 'signedIn' || !this.auth.userId()) return;
    if (!this.online()) {
      this.status.set('offline');
      return;
    }
    if (this.running) return;
    this.running = true;
    this.status.set('syncing');
    try {
      const userId = this.auth.userId()!;
      await this.pull();
      await this.push(userId);
      await this.syncCustomNouns(userId);
      this.lastSyncedAt.set(Date.now());
      this.lastError.set(null);
      this.status.set('idle');
    } catch (e) {
      this.lastError.set((e as Error).message);
      this.status.set('error');
      if (manual) throw e;
    } finally {
      this.running = false;
    }
  }

  // --- Pull (cloud -> local) ---------------------------------------------

  private async pull(): Promise<void> {
    for (const t of this.tables) {
      if (t.lww) await this.pullLww(t);
      else await this.pullEvents(t);
    }
  }

  private async pullLww(t: SyncTable): Promise<void> {
    const { data, error } = await supabase.from(t.remote).select('*');
    if (error) throw new Error(`pull ${t.remote}: ${error.message}`);
    for (const remote of data ?? []) {
      const row = t.fromRemote(remote);
      const pk = t.store === 'cardStates' ? row.cardId : row.id;
      const local = (await this.db.getRow(t.store, pk)) as
        | { updatedAt?: number }
        | undefined;
      if (!local || (row.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        await this.db.putRow(t.store, row);
      }
    }
  }

  private async pullEvents(t: SyncTable): Promise<void> {
    const watermark =
      (await this.db.getMeta<number>('sync.eventsWatermark')) ?? 0;
    const { data, error } = await supabase
      .from(t.remote)
      .select('*')
      .gt('ts', watermark)
      .order('ts', { ascending: true });
    if (error) throw new Error(`pull ${t.remote}: ${error.message}`);
    let maxTs = watermark;
    for (const remote of data ?? []) {
      const ev = t.fromRemote(remote) as StoredEvent;
      const existing = await this.db.getRow('events', ev.id);
      if (!existing) await this.db.putRow('events', ev);
      if (ev.ts > maxTs) maxTs = ev.ts;
    }
    if (maxTs > watermark) await this.db.setMeta('sync.eventsWatermark', maxTs);
  }

  // --- Push (local -> cloud) ---------------------------------------------

  private async push(userId: string): Promise<void> {
    const dirty = await this.db.getDirty();
    if (!dirty.length) return;
    const byStore = new Map<DirtyRow['store'], DirtyRow[]>();
    for (const d of dirty) {
      const list = byStore.get(d.store) ?? [];
      list.push(d);
      byStore.set(d.store, list);
    }

    for (const t of this.tables) {
      const entries = byStore.get(t.store);
      if (!entries?.length) continue;

      const rows: Record<string, unknown>[] = [];
      const keys: string[] = [];
      for (const d of entries) {
        const row = await this.db.getRow(t.store, d.pk);
        if (row) rows.push(t.toRemote(row, userId));
        keys.push(d.key); // clear even if the row is gone (deleted locally)
      }

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const q = t.lww
          ? supabase.from(t.remote).upsert(chunk)
          : supabase.from(t.remote).upsert(chunk, { ignoreDuplicates: true });
        const { error } = await q;
        if (error) throw new Error(`push ${t.remote}: ${error.message}`);
      }
      await this.db.clearDirty(keys);
    }
  }

  // --- Custom nouns (push-all + pull-all, create/update) -----------------

  private async syncCustomNouns(userId: string): Promise<void> {
    // Pull remote custom nouns, applying newer/absent ones locally.
    const { data, error } = await supabase.from('custom_nouns').select('*');
    if (error) throw new Error(`pull custom_nouns: ${error.message}`);
    for (const r of data ?? []) {
      const noun = { ...(r.data as Noun), updatedAt: r.client_updated_at };
      await this.catalog.applyRemoteUserNoun(noun);
    }
    // Push local custom nouns (few; a full upsert is cheap).
    const local = this.catalog.userNouns();
    if (local.length) {
      const rows = local.map((n) => ({
        user_id: userId,
        id: n.id,
        data: n,
        client_updated_at: n.updatedAt ?? Date.now(),
      }));
      const { error: upErr } = await supabase
        .from('custom_nouns')
        .upsert(rows);
      if (upErr) throw new Error(`push custom_nouns: ${upErr.message}`);
    }
  }
}
