import { Injectable, inject } from '@angular/core';
import { ActivityEvent } from '../models/types';
import { DbService } from './db.service';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private db = inject(DbService);

  log(event: ActivityEvent): Promise<void> {
    return this.db.addEvent(event);
  }
}
