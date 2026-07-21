import { Injectable, inject } from '@angular/core';
import { ActivityEvent } from '../models/types';
import { DbService } from './db.service';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private db = inject(DbService);

  async log(event: ActivityEvent): Promise<void> {
    await this.db.addEvent(event);
  }
}
