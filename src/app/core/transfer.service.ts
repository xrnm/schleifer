import { Injectable, inject } from '@angular/core';
import { ExportFile, Noun } from '../models/types';
import { CatalogService } from './catalog.service';
import { DbService } from './db.service';

interface ImportResult {
  cardStates: number;
  sessions: number;
  events: number;
  userNouns: number;
}

@Injectable({ providedIn: 'root' })
export class TransferService {
  private db = inject(DbService);
  private catalog = inject(CatalogService);

  async exportBlob(): Promise<Blob> {
    const [cardStates, sessions, events] = await Promise.all([
      this.db.getAllCardStates(),
      this.db.getAllSessions(),
      this.db.getAllEvents(),
    ]);
    const userNouns = this.catalog.userNouns();
    const catalogVersion =
      (await this.db.getMeta<string>('catalogVersion')) ?? '';
    const payload: ExportFile = {
      schema: 'schleifer.v2',
      exportedAt: Date.now(),
      catalogVersion,
      cardStates,
      sessions,
      events,
      userNouns,
    };
    await this.db.addEvent({
      kind: 'export',
      ts: payload.exportedAt,
      counts: {
        cardStates: cardStates.length,
        sessions: sessions.length,
        events: events.length,
        userNouns: userNouns.length,
      },
    });
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
  }

  async importJson(text: string): Promise<ImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('File is not valid JSON.');
    }
    const file = parsed as Partial<ExportFile>;
    if (file.schema !== 'schleifer.v1' && file.schema !== 'schleifer.v2') {
      throw new Error(`Unrecognized schema: ${String(file.schema)}`);
    }
    if (
      !Array.isArray(file.cardStates) ||
      !Array.isArray(file.sessions) ||
      !Array.isArray(file.events)
    ) {
      throw new Error('Missing required arrays in import file.');
    }

    await this.db.clearUserData();
    await this.db.bulkPut('cardStates', file.cardStates);
    await this.db.bulkPut('sessions', file.sessions);
    // v2 files carry stable string event ids; keep them. bulkAddEvents assigns
    // a fresh uuid to any legacy numeric/missing id (v1 files).
    await this.db.bulkAddEvents(file.events);
    // v2 also carries custom nouns; restore them via the catalog so cards
    // regenerate and the union refreshes.
    let userNouns = 0;
    if (Array.isArray(file.userNouns)) {
      for (const n of file.userNouns as Noun[]) {
        await this.catalog.applyRemoteUserNoun({
          ...n,
          updatedAt: n.updatedAt ?? Date.now(),
        });
        userNouns++;
      }
    }

    const counts: ImportResult = {
      cardStates: file.cardStates.length,
      sessions: file.sessions.length,
      events: file.events.length,
      userNouns,
    };
    await this.db.addEvent({
      kind: 'import',
      ts: Date.now(),
      counts: counts as unknown as Record<string, number>,
    });
    return counts;
  }
}
