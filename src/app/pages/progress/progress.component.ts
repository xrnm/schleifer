import { Component, OnInit, inject } from '@angular/core';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService } from '../../core/i18n.service';
import { SessionStarterService } from '../../core/session-starter.service';
import { CardState } from '../../models/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MASTERY_REPS = 4;

const CASE_LABEL: Record<string, string> = { nom: 'Nom', acc: 'Akk', dat: 'Dat' };
const NUMBER_LABEL: Record<string, string> = { sg: 'Sg', pl: 'Pl' };
const ARTICLE_LABEL: Record<string, string> = { def: 'best.', indef: 'unbest.' };

interface Row {
  cardId: string;
  noun: string;
  tags: string;
  lastShownAt: number | null;
  due: number;
  reps: number;
  lapses: number;
  result: string | null;
}

interface Group {
  key: 'dueNow' | 'thisWeek' | 'later';
  rows: Row[];
}

@Component({
  selector: 'app-progress',
  standalone: true,
  template: `
    <main class="page page--narrow">
      <span class="eyebrow">{{ i18n.t('progress.eyebrow') }}</span>
      <h1>{{ i18n.t('progress.title') }}</h1>
      <p class="muted">{{ i18n.t('progress.lead') }}</p>

      @if (loaded) {
        <div class="stat-strip" style="grid-template-columns: repeat(4, 1fr); margin-top: 16px;">
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ totalReviewed }}</span>
            <div class="stat-strip__lbl">{{ i18n.t('progress.stats.reviewed') }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ inLearning }}</span>
            <div class="stat-strip__lbl">{{ i18n.t('progress.stats.learning') }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ mastered }}</span>
            <div class="stat-strip__lbl">{{ i18n.t('progress.stats.mastered') }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ dueNow }}</span>
            <div class="stat-strip__lbl">{{ i18n.t('progress.stats.dueNow') }}</div>
          </div>
        </div>

        @if (totalReviewed === 0) {
          <p class="muted" style="margin-top: 24px;">{{ i18n.t('progress.empty') }}</p>
        } @else {
          @for (g of groups; track g.key) {
            @if (g.rows.length > 0) {
              <div class="group-h-row">
                <h3 class="group-h">
                  {{ i18n.t('progress.group.' + g.key) }}
                  <span class="group-count">{{ g.rows.length }}</span>
                </h3>
                @if (g.key === 'dueNow') {
                  <button
                    class="btn btn--primary"
                    (click)="drillDueNow()"
                    [disabled]="starting"
                  >
                    <span>{{ i18n.t('progress.drillDueNow', { n: g.rows.length }) }}</span>
                    <span class="arrow" aria-hidden="true">→</span>
                  </button>
                }
              </div>
              <ul class="timeline">
                @for (r of g.rows; track r.cardId) {
                  <li class="row">
                    <div class="row__noun">
                      <strong>{{ r.noun }}</strong>
                      <span class="row__tags">{{ r.tags }}</span>
                    </div>
                    <div class="row__times">
                      <div>
                        <span class="row__lbl">{{ i18n.t('progress.lastSeen') }}</span>
                        <span class="row__val">{{ i18n.relTime(r.lastShownAt, now) }}</span>
                      </div>
                      <div>
                        <span class="row__lbl">{{ i18n.t('progress.nextDue') }}</span>
                        <span class="row__val" [class.row__val--now]="r.due <= now">
                          {{ i18n.dueTime(r.due, now) }}
                        </span>
                      </div>
                    </div>
                    <div class="row__counts">
                      <span class="row__streak"
                        [class.row__streak--mastered]="r.reps >= MASTERY_REPS"
                      >✓ × {{ r.reps }}</span>
                      @if (r.lapses > 0) {
                        <span class="row__lapses">✗ × {{ r.lapses }}</span>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
          }
        }
      } @else {
        <p class="muted">…</p>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .group-h-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 32px 0 12px;
        gap: 12px;
        flex-wrap: wrap;
      }
      .group-h {
        margin: 0;
        font-family: var(--font-mono);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-weight: 700;
        color: var(--ink-2);
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--rule);
        flex: 1;
      }
      .group-count { color: var(--ink-3); font-weight: 500; }
      .timeline {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(160px, 1fr) auto auto;
        gap: 16px;
        align-items: center;
        background: transparent;
        border: 0;
        border-bottom: 1px solid var(--rule-2);
        border-radius: 0;
        padding: 12px 0;
      }
      .row__noun strong { font-weight: 700; font-size: 15px; color: var(--ink); margin-right: 8px; }
      .row__tags {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        letter-spacing: 0.06em;
      }
      .row__times { display: flex; gap: 18px; font-size: 12.5px; color: var(--ink-2); }
      .row__lbl {
        font-family: var(--font-mono);
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--ink-3);
        margin-right: 4px;
      }
      .row__val { color: var(--ink); font-weight: 500; font-family: var(--font-mono); font-size: 12px; }
      .row__val--now { color: var(--orange); font-weight: 700; }
      .row__counts {
        font-family: var(--font-mono);
        font-size: 12px;
        display: flex;
        gap: 10px;
        white-space: nowrap;
      }
      .row__streak { color: var(--ok); }
      .row__streak--mastered { font-weight: 700; }
      .row__lapses { color: var(--bad); }
      @media (max-width: 640px) {
        .row { grid-template-columns: 1fr; gap: 6px; }
        .row__times { flex-wrap: wrap; }
      }
    `,
  ],
})
export class ProgressComponent implements OnInit {
  private catalog = inject(CatalogService);
  private db = inject(DbService);
  private starter = inject(SessionStarterService);
  i18n = inject(I18nService);

  readonly MASTERY_REPS = MASTERY_REPS;
  loaded = false;
  starting = false;
  now = Date.now();

  totalReviewed = 0;
  inLearning = 0;
  mastered = 0;
  dueNow = 0;
  groups: Group[] = [];

  async ngOnInit() {
    await this.catalog.init();
    const states = await this.db.getAllCardStates();
    const reviewed = states.filter((s) => s.lastResult !== null);

    this.totalReviewed = reviewed.length;
    this.mastered = reviewed.filter((s) => s.reps >= MASTERY_REPS).length;
    this.inLearning = this.totalReviewed - this.mastered;
    this.dueNow = reviewed.filter((s) => s.due <= this.now).length;

    const rows = this.toRows(reviewed);
    this.groups = this.bucket(rows);
    this.loaded = true;
  }

  async drillDueNow() {
    const due = this.groups.find((g) => g.key === 'dueNow');
    if (!due || due.rows.length === 0) return;
    this.starting = true;
    try {
      // Oldest-due first matches the SRS "do the most overdue cards first" intuition.
      const cardIds = [...due.rows].sort((a, b) => a.due - b.due).map((r) => r.cardId);
      await this.starter.start(cardIds);
    } finally {
      this.starting = false;
    }
  }

  private toRows(states: CardState[]): Row[] {
    const rows: Row[] = [];
    for (const s of states) {
      const card = this.catalog.card(s.cardId);
      if (!card) continue;
      const noun = this.catalog.noun(card.nounId);
      if (!noun) continue;
      rows.push({
        cardId: s.cardId,
        noun: noun.singular,
        tags: `${CASE_LABEL[card.case]} · ${NUMBER_LABEL[card.number]} · ${ARTICLE_LABEL[card.articleType]}`,
        lastShownAt: s.lastShownAt,
        due: s.due,
        reps: s.reps,
        lapses: s.lapses,
        result: s.lastResult,
      });
    }
    return rows;
  }

  private bucket(rows: Row[]): Group[] {
    const dueNow: Row[] = [];
    const thisWeek: Row[] = [];
    const later: Row[] = [];
    const horizon = this.now + WEEK_MS;
    for (const r of rows) {
      if (r.due <= this.now) dueNow.push(r);
      else if (r.due <= horizon) thisWeek.push(r);
      else later.push(r);
    }
    dueNow.sort((a, b) => a.due - b.due);
    thisWeek.sort((a, b) => a.due - b.due);
    later.sort((a, b) => a.due - b.due);
    return [
      { key: 'dueNow', rows: dueNow },
      { key: 'thisWeek', rows: thisWeek },
      { key: 'later', rows: later },
    ];
  }
}
