import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService } from '../../core/i18n.service';
import { SelectorService } from '../../core/selector.service';
import { SessionStarterService } from '../../core/session-starter.service';
import { Session } from '../../models/types';

const SESSION_TARGET = 50;

@Component({
  selector: 'app-vokabular-home',
  standalone: true,
  imports: [],
  template: `
    <main class="page">
      <section class="hero">
        <span class="eyebrow">{{ i18n.t('vokabular.eyebrow') }}</span>
        <h1>{{ i18n.t('vokabular.h1') }}</h1>
        <p class="hero__sub">{{ i18n.t('vokabular.sub', { n: totalNouns }) }}</p>
        <div class="cta-row">
          <button class="btn btn--primary btn--lg" (click)="start()" [disabled]="starting">
            <span>{{ starting
              ? i18n.t('vokabular.starting')
              : i18n.t('vokabular.start', { n: sessionTarget }) }}</span>
            <span class="arrow" aria-hidden="true">→</span>
          </button>
          @if (loaded && dueNow > 0) {
            <button
              class="btn btn--ghost btn--lg"
              (click)="drillDueNow()"
              [disabled]="starting"
              style="border-color: var(--accent-deep); color: var(--accent-deep);"
            >
              <span>{{ i18n.t('vokabular.drillDueNow', { n: dueNow }) }}</span>
              <span class="arrow" aria-hidden="true">→</span>
            </button>
          }
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
    `,
  ],
})
export class VokabularHomeComponent implements OnInit {
  private catalog = inject(CatalogService);
  private db = inject(DbService);
  private selector = inject(SelectorService);
  private starter = inject(SessionStarterService);
  private router = inject(Router);
  i18n = inject(I18nService);

  readonly sessionTarget = SESSION_TARGET;
  totalNouns = 0;
  sessionsCompleted = 0;
  cardsAnswered = 0;
  dueNow = 0;
  loaded = false;
  starting = false;
  sessions: Session[] = [];

  async ngOnInit() {
    await this.catalog.init();
    this.totalNouns = this.catalog.allNouns().filter((n) => !!n.english).length;

    const [allSessions, states] = await Promise.all([
      this.db.getAllSessions(),
      this.db.getAllCardStates(),
    ]);

    const areas = await Promise.all(
      allSessions.map((s) => this.db.getMeta<string>(`session:${s.id}:area`)),
    );
    const sessions = allSessions.filter((_, i) => areas[i] === 'vokabular');
    sessions.sort((a, b) => b.startedAt - a.startedAt);
    this.sessions = sessions;
    this.sessionsCompleted = sessions.filter((s) => s.endedAt !== null).length;

    this.cardsAnswered = states.filter(
      (s) => s.lastResult !== null && s.cardId.endsWith('|translation'),
    ).length;

    this.dueNow = await this.selector.dueCount('vokabular');
    this.loaded = true;
  }

  async start() {
    this.starting = true;
    try {
      const cards = await this.selector.pickVokabularSession(SESSION_TARGET);
      await this.starter.start(cards.map((c) => c.id), 'vokabular');
    } finally {
      this.starting = false;
    }
  }

  async drillDueNow() {
    if (this.dueNow === 0) return;
    this.starting = true;
    try {
      const ids = await this.selector.dueCardIds('vokabular');
      await this.starter.start(ids, 'vokabular');
    } finally {
      this.starting = false;
    }
  }

  openSession(id: string) {
    this.router.navigate(['/vokabular', 'session', id]);
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
