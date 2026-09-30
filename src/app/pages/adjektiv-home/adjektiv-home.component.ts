import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService, LOCALE_BY_LANG } from '../../core/i18n.service';
import { SelectorService } from '../../core/selector.service';
import { SessionStarterService } from '../../core/session-starter.service';
import { SettingsService } from '../../core/settings.service';
import { AdjClassFilter, CaseFilter, NumberFilter, Session } from '../../models/types';
import { isAdjectiveCardId } from '../../core/adjective';
import { AdjRuleCardComponent } from '../../shared/adj-rule-card.component';

// Only 36 ending cells exist, so a full-ish sweep is a sensible daily target;
// once the table is learned, the due queue drives session length down.
const SESSION_TARGET = 30;

@Component({
  selector: 'app-adjektiv-home',
  standalone: true,
  imports: [AdjRuleCardComponent],
  template: `
    <main class="page">
      <section class="hero">
        <span class="eyebrow">{{ i18n.t('adjektiv.eyebrow') }}</span>
        <h1>{{ i18n.t('adjektiv.h1') }}</h1>
        <p class="hero__sub">{{ i18n.t('adjektiv.sub', { n: totalAdjectives }) }}</p>
        <div class="cta-row">
          <button class="btn btn--primary btn--lg" (click)="start()" [disabled]="starting">
            <span>{{ starting
              ? i18n.t('adjektiv.starting')
              : i18n.t('adjektiv.start', { n: sessionTarget }) }}</span>
            <span class="arrow" aria-hidden="true">→</span>
          </button>
          <button
            class="btn btn--ghost btn--lg gear-btn"
            type="button"
            (click)="toggleDrawer()"
            [class.is-open]="drawerOpen()"
            [attr.aria-expanded]="drawerOpen()"
            [attr.aria-label]="i18n.t('home.settings.toggleAria')"
            [title]="i18n.t('home.settings')"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button class="btn btn--ghost btn--lg" type="button" (click)="ruleOpen.set(true)">
            <span>{{ i18n.t('adjektiv.rules.open') }}</span>
          </button>
          @if (loaded && dueNow > 0) {
            <button
              class="btn btn--ghost btn--lg"
              (click)="drillDueNow()"
              [disabled]="starting"
              style="border-color: var(--accent-deep); color: var(--accent-deep);"
            >
              <span>{{ i18n.t('adjektiv.drillDueNow', { n: dueNow }) }}</span>
              <span class="arrow" aria-hidden="true">→</span>
            </button>
          }
        </div>

        @if (drawerOpen()) {
          <section class="settings-drawer" [attr.aria-label]="i18n.t('home.settings')">
            <div class="settings-row">
              <span class="settings-row__k">{{ i18n.t('settings.case') }}</span>
              <div class="settings-pills" role="group" [attr.aria-label]="i18n.t('settings.case')">
                @for (opt of caseOptions; track opt.value) {
                  <button
                    type="button"
                    class="pill"
                    [class.is-active]="settings.settings().adjCaseFilter === opt.value"
                    (click)="setCase(opt.value)"
                  >{{ i18n.t(opt.labelKey) }}</button>
                }
              </div>
            </div>
            <div class="settings-row">
              <span class="settings-row__k">{{ i18n.t('settings.number') }}</span>
              <div class="settings-pills" role="group" [attr.aria-label]="i18n.t('settings.number')">
                @for (opt of numberOptions; track opt.value) {
                  <button
                    type="button"
                    class="pill"
                    [class.is-active]="settings.settings().adjNumberFilter === opt.value"
                    (click)="setNumber(opt.value)"
                  >{{ i18n.t(opt.labelKey) }}</button>
                }
              </div>
            </div>
            <div class="settings-row">
              <span class="settings-row__k">{{ i18n.t('settings.class') }}</span>
              <div class="settings-pills" role="group" [attr.aria-label]="i18n.t('settings.class')">
                @for (opt of classOptions; track opt.value) {
                  <button
                    type="button"
                    class="pill"
                    [class.is-active]="settings.settings().adjClassFilter === opt.value"
                    (click)="setClass(opt.value)"
                  >{{ i18n.t(opt.labelKey) }}</button>
                }
              </div>
            </div>
          </section>
        }
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
    <app-adj-rule-card [(open)]="ruleOpen" />
  `,
  styles: [
    `
      .session-row { outline: none; }
      .session-row:focus-visible {
        border-color: var(--brand-primary);
        box-shadow: 0 0 0 3px var(--focus-ring);
      }
      .gear-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 14px 16px;
        color: var(--ink-2);
      }
      .gear-btn:hover { color: var(--orange); border-color: var(--orange); }
      .gear-btn.is-open {
        color: var(--orange);
        border-color: var(--orange);
        background: rgba(255, 91, 31, 0.06);
      }
      .gear-btn svg { display: block; transition: transform var(--dur-fast) var(--ease-standard); }
      .gear-btn.is-open svg { transform: rotate(45deg); }
      .settings-drawer {
        margin-top: 16px;
        border: 1px solid var(--rule);
        border-left: 3px solid var(--orange);
        background: var(--bg-2);
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: drawer-in 180ms var(--ease-standard, ease-out);
      }
      @keyframes drawer-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .settings-row {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .settings-row__k {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 10.5px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--ink-3);
        min-width: 70px;
      }
      .settings-pills {
        display: inline-flex;
        gap: 0;
        border: 1px solid var(--rule);
        background: var(--bg);
      }
      .pill {
        background: transparent;
        border: 0;
        border-right: 1px solid var(--rule);
        padding: 8px 14px;
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: var(--ink-2);
        cursor: pointer;
        text-transform: uppercase;
        transition:
          color var(--dur-fast) var(--ease-standard),
          background var(--dur-fast) var(--ease-standard);
      }
      .pill:last-child { border-right: 0; }
      .pill:hover { color: var(--ink); background: var(--bg-3); }
      .pill.is-active { color: var(--bg); background: var(--orange); }
      .pill:focus-visible {
        outline: 2px solid var(--orange);
        outline-offset: 2px;
        position: relative;
        z-index: 1;
      }
      @media (max-width: 640px) {
        .settings-row { gap: 8px; }
        .settings-row__k { min-width: 0; }
        .pill { padding: 8px 10px; font-size: 10px; }
      }
    `,
  ],
})
export class AdjektivHomeComponent implements OnInit {
  private catalog = inject(CatalogService);
  private db = inject(DbService);
  private selector = inject(SelectorService);
  private starter = inject(SessionStarterService);
  private router = inject(Router);
  i18n = inject(I18nService);
  settings = inject(SettingsService);

  readonly sessionTarget = SESSION_TARGET;
  totalAdjectives = 0;
  sessionsCompleted = 0;
  cardsAnswered = 0;
  dueNow = 0;
  loaded = false;
  starting = false;
  sessions: Session[] = [];

  drawerOpen = signal(false);
  ruleOpen = signal(false);

  readonly caseOptions: { value: CaseFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'settings.case.all' },
    { value: 'nom', labelKey: 'settings.case.nom' },
    { value: 'acc', labelKey: 'settings.case.acc' },
    { value: 'dat', labelKey: 'settings.case.dat' },
  ];
  readonly numberOptions: { value: NumberFilter; labelKey: string }[] = [
    { value: 'both', labelKey: 'settings.number.both' },
    { value: 'sg', labelKey: 'settings.number.sg' },
    { value: 'pl', labelKey: 'settings.number.pl' },
  ];
  readonly classOptions: { value: AdjClassFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'settings.class.all' },
    { value: 'weak', labelKey: 'settings.class.weak' },
    { value: 'mixed', labelKey: 'settings.class.mixed' },
    { value: 'strong', labelKey: 'settings.class.strong' },
  ];

  toggleDrawer() { this.drawerOpen.update((v) => !v); }

  setCase(v: CaseFilter) {
    this.settings.setAdjCaseFilter(v);
    void this.refreshDueNow();
  }
  setNumber(v: NumberFilter) {
    this.settings.setAdjNumberFilter(v);
    void this.refreshDueNow();
  }
  setClass(v: AdjClassFilter) {
    this.settings.setAdjClassFilter(v);
    void this.refreshDueNow();
  }

  private async refreshDueNow() {
    this.dueNow = await this.selector.dueCount('adjektiv');
  }

  async ngOnInit() {
    await this.catalog.init();
    this.totalAdjectives = this.catalog.allAdjectives().length;

    const [allSessions, states] = await Promise.all([
      this.db.getAllSessions(),
      this.db.getAllCardStates(),
    ]);

    const areas = await Promise.all(
      allSessions.map((s) => this.db.getMeta<string>(`session:${s.id}:area`)),
    );
    const sessions = allSessions.filter((_, i) => areas[i] === 'adjektiv');
    sessions.sort((a, b) => b.startedAt - a.startedAt);
    this.sessions = sessions;
    this.sessionsCompleted = sessions.filter((s) => s.endedAt !== null).length;

    this.cardsAnswered = states.filter(
      (s) => s.lastResult !== null && isAdjectiveCardId(s.cardId),
    ).length;

    this.dueNow = await this.selector.dueCount('adjektiv');
    this.loaded = true;
  }

  async start() {
    this.starting = true;
    try {
      const ids = await this.selector.pickAdjektivSession(
        SESSION_TARGET,
        this.settings.settings(),
      );
      await this.starter.start(ids, 'adjektiv');
    } finally {
      this.starting = false;
    }
  }

  async drillDueNow() {
    if (this.dueNow === 0) return;
    this.starting = true;
    try {
      const ids = await this.selector.dueCardIds('adjektiv');
      await this.starter.start(ids, 'adjektiv');
    } finally {
      this.starting = false;
    }
  }

  openSession(id: string) {
    this.router.navigate(['/adjektiv', 'session', id]);
  }

  formatDate(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const locale = LOCALE_BY_LANG[this.i18n.lang()];
    const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `${this.i18n.t('home.today')} ${time}`;
    if (isYesterday) return `${this.i18n.t('home.yesterday')} ${time}`;
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) + ' ' + time;
  }
}
