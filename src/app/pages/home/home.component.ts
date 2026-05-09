import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService } from '../../core/i18n.service';
import { SelectorService } from '../../core/selector.service';
import { SessionStarterService } from '../../core/session-starter.service';
import { CardState, Session } from '../../models/types';

const SESSION_TARGET = 50;
const RECENT_FAIL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const IN_PROGRESS_REPS_THRESHOLD = 3;
const LIST_LIMIT = 10;

const CASE_LABEL: Record<string, string> = { nom: 'Nom', acc: 'Akk', dat: 'Dat' };
const NUMBER_LABEL: Record<string, string> = { sg: 'Sg', pl: 'Pl' };
const ARTICLE_LABEL: Record<string, string> = { def: 'best.', indef: 'unbest.' };

interface WordRow {
  cardId: string;
  noun: string;
  tags: string;
  lastShownAt: number | null;
  due: number;
  reps: number;
  lapses: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page">
      <section class="hero">
        <span class="eyebrow">{{ i18n.t('eyebrow.dailyDrill') }}</span>
        <h1>{{ i18n.t('home.h1') }}</h1>
        <p class="hero__sub">{{ i18n.t('home.sub', { n: totalNouns }) }}</p>
        <div class="cta-row">
          <button class="btn btn--primary btn--lg" (click)="start()" [disabled]="starting">
            <span>{{ starting
              ? i18n.t('home.starting')
              : i18n.t('home.start', { n: sessionTarget }) }}</span>
            <span class="arrow" aria-hidden="true">→</span>
          </button>
          @if (loaded && dueNow > 0) {
            <button
              class="btn btn--ghost btn--lg"
              (click)="drillDueNow()"
              [disabled]="starting"
              style="border-color: var(--accent-deep); color: var(--accent-deep);"
            >
              <span>{{ i18n.t('home.drillDueNow', { n: dueNow }) }}</span>
              <span class="arrow" aria-hidden="true">→</span>
            </button>
          }
          <button class="btn btn--ghost" (click)="goData()">{{ i18n.t('home.dataExport') }}</button>
          <span class="kbd-hint">
            <span class="kbd">Enter</span> {{ enterText }}
            <span style="margin: 0 4px;">·</span>
            <span class="kbd">Esc</span> {{ escText }}
          </span>
        </div>
      </section>

      @if (loaded) {
        <div class="stat-strip">
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ sessionsCompleted }}</span>
            <div class="stat-strip__lbl">{{ i18n.t('home.label.sessions') }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ cardsAnswered }}</span>
            <div class="stat-strip__lbl">{{ i18n.t('home.label.cardsReviewed') }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ dueNow }}</span>
            <div class="stat-strip__lbl">{{ i18n.t('home.label.dueNow') }}</div>
          </div>
        </div>

        <div class="section-h">
          <h3>{{ i18n.t('home.sessions') }}</h3>
        </div>
        @if (sessions.length === 0) {
          <p class="muted">{{ i18n.t('home.noSessions') }}</p>
        } @else {
          <ul class="session-list" style="list-style: none; padding: 0; margin: 0;">
            @for (s of sessions; track s.id) {
              <li
                class="session-row"
                tabindex="0"
                (click)="openSession(s.id)"
                (keydown.enter)="openSession(s.id)"
              >
                <div class="session-row__when">{{ formatDate(s.startedAt) }}</div>
                <div class="session-row__right">
                  <div class="counters">
                    <span class="c-ok">✓ {{ s.correct }}</span>
                    <span class="c-bad">✗ {{ s.incorrect }}</span>
                    <span class="c-unk">? {{ s.idk }}</span>
                    <span class="c-skip">↺ {{ s.skipped }}</span>
                  </div>
                  <span
                    class="session-row__status"
                    [class.is-done]="s.endedAt"
                    [class.is-progress]="!s.endedAt"
                  >
                    {{ s.endedAt ? i18n.t('home.statusCompleted') : i18n.t('home.statusInProgress') }}
                  </span>
                  <span class="session-row__arrow" aria-hidden="true">→</span>
                </div>
              </li>
            }
          </ul>
        }

        <div class="two-col">
          <article class="col-card">
            <div class="col-card__title">
              <b>{{ i18n.t('home.inProgress') }}</b>
              <span>{{ inProgress.length }}</span>
            </div>
            @if (inProgress.length === 0) {
              <p class="muted tiny">{{ i18n.t('home.inProgressEmpty') }}</p>
            } @else {
              @for (w of inProgressTop; track w.cardId) {
                <div class="word-pill word-pill--stacked">
                  <div class="word-pill__main">
                    <span class="w">{{ w.noun }}</span>
                    <span class="meta">{{ w.tags }}</span>
                  </div>
                  <div class="word-pill__times">
                    <span>{{ i18n.t('progress.lastSeen') }} {{ i18n.relTime(w.lastShownAt) }}</span>
                    <span class="sep">·</span>
                    <span [class.due-now]="w.due <= now">{{ i18n.t('progress.nextDue') }} {{ i18n.dueTime(w.due, now) }}</span>
                  </div>
                </div>
              }
              @if (inProgress.length > inProgressTop.length) {
                <div class="more">{{ i18n.t('home.andMore', { n: inProgress.length - inProgressTop.length }) }}</div>
              }
              <a routerLink="/progress" class="card-link">{{ i18n.t('home.viewTimeline') }}</a>
            }
          </article>

          <article class="col-card">
            <div class="col-card__title">
              <b>{{ i18n.t('home.recentlyMissed') }}</b>
              <span>{{ recentlyMissed.length }}</span>
            </div>
            @if (recentlyMissed.length === 0) {
              <p class="muted tiny">{{ i18n.t('home.recentlyMissedEmpty') }}</p>
            } @else {
              @for (w of recentlyMissedTop; track w.cardId) {
                <div class="word-pill word-pill--stacked">
                  <div class="word-pill__main">
                    <span class="w">{{ w.noun }}</span>
                    <span class="meta">{{ w.tags }}</span>
                    <span class="right miss">{{ i18n.t('home.missedCount', { n: w.lapses }) }}</span>
                  </div>
                  <div class="word-pill__times">
                    <span>{{ i18n.t('progress.lastSeen') }} {{ i18n.relTime(w.lastShownAt) }}</span>
                    <span class="sep">·</span>
                    <span [class.due-now]="w.due <= now">{{ i18n.t('progress.nextDue') }} {{ i18n.dueTime(w.due, now) }}</span>
                  </div>
                </div>
              }
              @if (recentlyMissed.length > recentlyMissedTop.length) {
                <div class="more">{{ i18n.t('home.andMore', { n: recentlyMissed.length - recentlyMissedTop.length }) }}</div>
              }
              <a routerLink="/progress" class="card-link">{{ i18n.t('home.viewTimeline') }}</a>
            }
          </article>
        </div>
      }
    </main>
  `,
  styles: [
    `
      .session-row { outline: none; }
      .session-row:focus-visible {
        border-color: var(--brand-primary);
        box-shadow: 0 0 0 3px var(--focus-ring);
      }
      .word-pill--stacked {
        display: flex !important;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
      }
      .word-pill__main {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .word-pill__main .right {
        margin-left: auto;
      }
      .word-pill__times {
        display: flex;
        gap: 6px;
        font-family: var(--font-mono);
        font-size: 10.5px;
        letter-spacing: 0.04em;
        color: var(--ink-tertiary);
        text-transform: lowercase;
      }
      .word-pill__times .sep { color: var(--border-strong); }
      .word-pill__times .due-now {
        color: var(--semantic-warning);
        font-weight: 600;
      }
      .card-link {
        display: inline-block;
        margin-top: 10px;
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--brand-primary);
        text-decoration: none;
      }
      .card-link:hover { text-decoration: underline; }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private catalog = inject(CatalogService);
  private db = inject(DbService);
  private selector = inject(SelectorService);
  private starter = inject(SessionStarterService);
  private router = inject(Router);
  i18n = inject(I18nService);

  readonly sessionTarget = SESSION_TARGET;
  now = Date.now();
  totalNouns = 0;
  sessionsCompleted = 0;
  cardsAnswered = 0;
  dueNow = 0;
  loaded = false;
  starting = false;

  sessions: Session[] = [];
  inProgress: WordRow[] = [];
  recentlyMissed: WordRow[] = [];

  get inProgressTop(): WordRow[] { return this.inProgress.slice(0, LIST_LIMIT); }
  get recentlyMissedTop(): WordRow[] { return this.recentlyMissed.slice(0, LIST_LIMIT); }

  // Localized "to submit / to skip" snippets for the keyboard hint.
  get enterText() {
    return this.i18n.lang() === 'de' ? 'zum Absenden' : 'to submit';
  }
  get escText() {
    return this.i18n.lang() === 'de' ? 'zum Überspringen' : 'to skip';
  }

  async ngOnInit() {
    await this.catalog.init();
    this.totalNouns = this.catalog.allNouns().length;

    const [sessions, states] = await Promise.all([
      this.db.getAllSessions(),
      this.db.getAllCardStates(),
    ]);

    sessions.sort((a, b) => b.startedAt - a.startedAt);
    this.sessions = sessions;
    this.sessionsCompleted = sessions.filter((s) => s.endedAt !== null).length;
    this.cardsAnswered = states.filter((s) => s.lastResult !== null).length;

    const now = Date.now();
    this.dueNow = states.filter(
      (s) => s.lastResult !== null && s.due <= now,
    ).length;

    this.inProgress = this.buildWordRows(
      states.filter(
        (s) => s.lastResult !== null && s.reps < IN_PROGRESS_REPS_THRESHOLD,
      ),
    );

    this.recentlyMissed = this.buildWordRows(
      states.filter(
        (s) =>
          (s.lastResult === 'incorrect' || s.lastResult === 'idk') &&
          s.lastShownAt !== null &&
          now - s.lastShownAt <= RECENT_FAIL_WINDOW_MS,
      ),
    );

    this.loaded = true;
  }

  private buildWordRows(states: CardState[]): WordRow[] {
    const rows: WordRow[] = [];
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
      });
    }
    rows.sort((a, b) => (b.lastShownAt ?? 0) - (a.lastShownAt ?? 0));
    return rows;
  }

  async start() {
    this.starting = true;
    try {
      const cards = await this.selector.pickSession(SESSION_TARGET);
      await this.starter.start(cards.map((c) => c.id));
    } finally {
      this.starting = false;
    }
  }

  async drillDueNow() {
    if (this.dueNow === 0) return;
    this.starting = true;
    try {
      // Pull cardStates again so we send the latest snapshot (the home
      // component caches counts but not the full row list for due-now).
      const states = await this.db.getAllCardStates();
      const now = Date.now();
      const ids = states
        .filter((s) => s.lastResult !== null && s.due <= now)
        .sort((a, b) => a.due - b.due)
        .map((s) => s.cardId);
      await this.starter.start(ids);
    } finally {
      this.starting = false;
    }
  }

  openSession(id: string) {
    this.router.navigate(['/session', id]);
  }

  goData() {
    this.router.navigate(['/data']);
  }

  formatDate(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const locale = this.i18n.lang() === 'de' ? 'de-DE' : undefined;
    const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `${this.i18n.t('home.today')} ${time}`;
    if (isYesterday) return `${this.i18n.t('home.yesterday')} ${time}`;
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) + ' ' + time;
  }
}
