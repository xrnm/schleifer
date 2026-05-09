import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActivityService } from './activity.service';
import { DbService } from './db.service';
import { Session } from '../models/types';

/**
 * Creates a session row, logs the start event, stores the card list in
 * meta, and navigates to /session/:id. Used by both the home "Start
 * session" button and the progress "Drill due now" button.
 */
@Injectable({ providedIn: 'root' })
export class SessionStarterService {
  private db = inject(DbService);
  private activity = inject(ActivityService);
  private router = inject(Router);

  async start(cardIds: string[]): Promise<string | null> {
    if (cardIds.length === 0) return null;
    const id = crypto.randomUUID();
    const session: Session = {
      id,
      startedAt: Date.now(),
      endedAt: null,
      targetCount: cardIds.length,
      presented: 0,
      correct: 0,
      incorrect: 0,
      idk: 0,
      skipped: 0,
    };
    await this.db.putSession(session);
    await this.activity.log({
      kind: 'session_start',
      ts: session.startedAt,
      sessionId: id,
    });
    await this.db.setMeta(`session:${id}:cards`, cardIds);
    await this.router.navigate(['/session', id]);
    return id;
  }
}
