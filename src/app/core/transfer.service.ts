import { Injectable, inject } from '@angular/core';
import { ActivityEvent, ExportFile } from '../models/types';
import { DbService } from './db.service';

interface ImportResult {
  cardStates: number;
  sessions: number;
  events: number;
}

@Injectable({ providedIn: 'root' })
export class TransferService {
  private db = inject(DbService);

  async exportBlob(): Promise<Blob> {
    const [cardStates, sessions, events] = await Promise.all([
      this.db.getAllCardStates(),
      this.db.getAllSessions(),
      this.db.getAllEvents(),
    ]);
    const catalogVersion =
      (await this.db.getMeta<string>('catalogVersion')) ?? '';
    const payload: ExportFile = {
      schema: 'schleifer.v1',
      exportedAt: Date.now(),
      catalogVersion,
      cardStates,
      sessions,
      events,
    };
    await this.db.addEvent({
      kind: 'export',
      ts: payload.exportedAt,
      counts: {
        cardStates: cardStates.length,
        sessions: sessions.length,
        events: events.length,
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
    if (file.schema !== 'schleifer.v1') {
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
    // Strip incoming auto-increment ids so events get fresh ones.
    const eventsClean: ActivityEvent[] = (file.events as (ActivityEvent & { id?: number })[]).map(
      (e) => {
        const { ...rest } = e;
        delete (rest as { id?: number }).id;
        return rest as ActivityEvent;
      },
    );
    await this.db.bulkAddEvents(eventsClean);
    const counts: ImportResult = {
      cardStates: file.cardStates.length,
      sessions: file.sessions.length,
      events: file.events.length,
    };
    await this.db.addEvent({
      kind: 'import',
      ts: Date.now(),
      counts: counts as unknown as Record<string, number>,
    });
    return counts;
  }
}
