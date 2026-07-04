import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService } from '../../core/i18n.service';
import { SelectorService } from '../../core/selector.service';
import { SessionStarterService } from '../../core/session-starter.service';
import { LOCALE_BY_LANG } from '../../core/i18n.service';
import { SettingsService } from '../../core/settings.service';
import {
  ArticleFilter,
  CardState,
  CaseFilter,
  NumberFilter,
  PossessiveScope,
  Session,
} from '../../models/types';

const SESSION_TARGET = 50;
const RECENT_FAIL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const IN_PROGRESS_REPS_THRESHOLD = 3;
const LIST_LIMIT = 10;

const CASE_LABEL: Record<string, string> = { nom: 'Nom', acc: 'Akk', dat: 'Dat' };
const NUMBER_LABEL: Record<string, string> = { sg: 'Sg', pl: 'Pl' };
const ARTICLE_LABEL: Record<string, string> = {
  def: 'best.',
  indef: 'unbest.',
  poss: 'poss.',
};

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
          <span class="kbd-hint">
            <span class="kbd">Enter</span> {{ enterText }}
            <span style="margin: 0 4px;">·</span>
            <span class="kbd">Esc</span> {{ escText }}
          </span>
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
                    [class.is-active]="settings.settings().caseFilter === opt.value"
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
                    [class.is-active]="settings.settings().numberFilter === opt.value"
                    (click)="setNumber(opt.value)"
                  >{{ i18n.t(opt.labelKey) }}</button>
                }
              </div>
            </div>
            <div class="settings-row">
              <span class="settings-row__k">{{ i18n.t('settings.article') }}</span>
              <div class="settings-pills" role="group" [attr.aria-label]="i18n.t('settings.article')">
                @for (opt of articleOptions; track opt.value) {
                  <button
                    type="button"
                    class="pill"
                    [class.is-active]="settings.settings().articleFilter === opt.value"
                    (click)="setArticle(opt.value)"
                  >{{ i18n.t(opt.labelKey) }}</button>
                }
              </div>
            </div>
            <div class="settings-row">
              <span class="settings-row__k">{{ i18n.t('settings.possessive') }}</span>
              <div class="settings-pills" role="group" [attr.aria-label]="i18n.t('settings.possessive')">
                @for (opt of possessiveOptions; track opt.value) {
                  <button
                    type="button"
                    class="pill"
                    [class.is-active]="settings.settings().possessiveScope === opt.value"
                    (click)="setPossessive(opt.value)"
                    [title]="opt.titleKey ? i18n.t(opt.titleKey) : ''"
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
      .pill.is-active {
        color: var(--bg);
        background: var(--orange);
      }
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
export class HomeComponent implements OnInit {
  private catalog = inject(CatalogService);
  private db = inject(DbService);
  private selector = inject(SelectorService);
  private starter = inject(SessionStarterService);
  private router = inject(Router);
  i18n = inject(I18nService);
  settings = inject(SettingsService);

  readonly sessionTarget = SESSION_TARGET;
  now = Date.now();
  totalNouns = 0;
  sessionsCompleted = 0;
  cardsAnswered = 0;
  dueNow = 0;
  loaded = false;
  starting = false;

  drawerOpen = signal(false);

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
  readonly articleOptions: { value: ArticleFilter; labelKey: string }[] = [
    { value: 'both', labelKey: 'settings.article.both' },
    { value: 'def', labelKey: 'settings.article.def' },
    { value: 'indef', labelKey: 'settings.article.indef' },
  ];
  readonly possessiveOptions: {
    value: PossessiveScope;
    labelKey: string;
    titleKey?: string;
  }[] = [
    { value: 'off', labelKey: 'settings.poss.off', titleKey: 'settings.poss.off.title' },
    { value: 'basic2', labelKey: 'settings.poss.basic2', titleKey: 'settings.poss.basic2.title' },
    { value: 'core4', labelKey: 'settings.poss.core4', titleKey: 'settings.poss.core4.title' },
    { value: 'all7', labelKey: 'settings.poss.all7', titleKey: 'settings.poss.all7.title' },
  ];

  filteredDueNow = computed(() => this.dueNow);

  sessions: Session[] = [];
  inProgress: WordRow[] = [];
  recentlyMissed: WordRow[] = [];

  get inProgressTop(): WordRow[] { return this.inProgress.slice(0, LIST_LIMIT); }
  get recentlyMissedTop(): WordRow[] { return this.recentlyMissed.slice(0, LIST_LIMIT); }

  get enterText() { return this.i18n.t('home.kbdHint.enter'); }
  get escText() { return this.i18n.t('home.kbdHint.esc'); }

  toggleDrawer() { this.drawerOpen.update((v) => !v); }

  setCase(v: CaseFilter) {
    this.settings.setCaseFilter(v);
    void this.refreshDueNow();
  }
  setNumber(v: NumberFilter) {
    this.settings.setNumberFilter(v);
    void this.refreshDueNow();
  }
  setArticle(v: ArticleFilter) {
    this.settings.setArticleFilter(v);
    void this.refreshDueNow();
  }
  setPossessive(v: PossessiveScope) {
    this.settings.setPossessiveScope(v);
    void this.refreshDueNow();
  }

  private async refreshDueNow() {
    this.dueNow = await this.selector.dueCount('deklination');
  }

  async ngOnInit() {
    await this.catalog.init();
    this.totalNouns = this.catalog.allNouns().length;

    const [allSessions, states] = await Promise.all([
      this.db.getAllSessions(),
      this.db.getAllCardStates(),
    ]);

    const areas = await Promise.all(
      allSessions.map((s) => this.db.getMeta<string>(`session:${s.id}:area`)),
    );
    const sessions = allSessions.filter(
      (_, i) => (areas[i] ?? 'deklination') === 'deklination',
    );
    sessions.sort((a, b) => b.startedAt - a.startedAt);
    this.sessions = sessions;
    this.sessionsCompleted = sessions.filter((s) => s.endedAt !== null).length;
    this.cardsAnswered = states.filter(
      (s) => s.lastResult !== null && !s.cardId.endsWith('|translation'),
    ).length;

    this.dueNow = await this.selector.dueCount('deklination');

    const now = Date.now();
    this.inProgress = this.buildWordRows(
      states.filter(
        (s) =>
          s.lastResult !== null &&
          s.reps < IN_PROGRESS_REPS_THRESHOLD &&
          !s.cardId.endsWith('|translation'),
      ),
    );

    this.recentlyMissed = this.buildWordRows(
      states.filter(
        (s) =>
          (s.lastResult === 'incorrect' || s.lastResult === 'idk') &&
          s.lastShownAt !== null &&
          now - s.lastShownAt <= RECENT_FAIL_WINDOW_MS &&
          !s.cardId.endsWith('|translation'),
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
      const base = `${CASE_LABEL[card.case]} · ${NUMBER_LABEL[card.number]} · ${ARTICLE_LABEL[card.articleType]}`;
      const tags = card.possessive ? `${base} · ${card.possessive}` : base;
      rows.push({
        cardId: s.cardId,
        noun: noun.singular,
        tags,
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
      const cards = await this.selector.pickDeklinationSession(
        SESSION_TARGET,
        this.settings.settings(),
      );
      await this.starter.start(cards.map((c) => c.id), 'deklination');
    } finally {
      this.starting = false;
    }
  }

  async drillDueNow() {
    if (this.dueNow === 0) return;
    this.starting = true;
    try {
      const ids = await this.selector.dueCardIds('deklination');
      await this.starter.start(ids, 'deklination');
    } finally {
      this.starting = false;
    }
  }

  openSession(id: string) {
    this.router.navigate(['/session', id]);
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
