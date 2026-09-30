import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivityService } from '../../core/activity.service';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService } from '../../core/i18n.service';
import { SpeakButtonComponent } from '../../shared/speak-button.component';
import { AdjRuleCardComponent } from '../../shared/adj-rule-card.component';
import {
  AdjCell,
  AdjSurface,
  adjPhraseGlossEn,
  checkAdjAnswer,
  detectAdjClassMismatch,
  expectedAdjPhrase,
  parseAdjCellId,
  pickAdjSurface,
} from '../../core/adjective';
import { expectedAnswer } from '../../core/declension';
import { applyResult, newCardState } from '../../core/srs';
import { AdjClass, AdjectiveEntry, AnswerResult, Noun, Session } from '../../models/types';

interface QueuedCard {
  cardId: string;
  cell: AdjCell;
  adj: AdjectiveEntry;
  noun: Noun;
  expected: string;
  glossEn: string;
  // The noun in nominative singular with its definite article ("die Milch") —
  // shown in feedback so the gender that drives the ending is always taught.
  nom: string;
}

interface AnswerRow {
  cue: string;
  tags: string;
  entered: string;
  expected: string;
  gloss: string;
  nom: string;
  result: AnswerResult;
  typo: boolean;
  caps: boolean;
}

const CASE_LABEL: Record<string, string> = {
  nom: 'Nominativ',
  acc: 'Akkusativ',
  dat: 'Dativ',
};
const NUMBER_LABEL: Record<string, string> = { sg: 'Singular', pl: 'Plural' };
const CLASS_LABEL: Record<string, string> = {
  weak: 'schwach',
  mixed: 'gemischt',
  strong: 'stark',
};

@Component({
  selector: 'app-adjektiv-session',
  standalone: true,
  imports: [FormsModule, SpeakButtonComponent, AdjRuleCardComponent],
  template: `
    @if (loaded && session && done) {
      <main class="page page--narrow">
        <span class="eyebrow">{{ i18n.t('eyebrow.sessionComplete') }}</span>
        <h1>{{ i18n.t('adjektiv.summaryH1') }}</h1>
        <div class="review-summary">
          <span class="c-ok">✓ {{ i18n.t('session.stats.correct', { n: session.correct }) }}</span>
          <span class="c-bad">✗ {{ i18n.t('session.stats.wrong', { n: session.incorrect }) }}</span>
          @if (session.skipped > 0) {
            <span class="c-skip">↺ {{ i18n.t('session.stats.skipped', { n: session.skipped }) }}</span>
          }
        </div>

        <div class="cta-row">
          <button #backBtn class="btn btn--ghost" (click)="goHome()">
            {{ i18n.t('session.backToHome') }}
          </button>
        </div>

        @if (missedAnswers.length > 0) {
          <section class="review-section">
            <h3 class="review-section__h miss">
              {{ i18n.t('session.missedHeading', { n: missedAnswers.length }) }}
            </h3>
            @for (a of missedAnswers; track $index) {
              <div class="review-card">
                <div class="review-card__head">
                  <b>{{ a.cue }}</b>
                  <span class="meta">{{ a.tags }}</span>
                </div>
                <div class="review-card__line">
                  <span class="muted">{{ wroteText }}</span>
                  <span class="you">{{ a.entered || '—' }}</span>
                  <span class="muted"> · {{ expectedText }}</span>
                  <span class="ans">{{ a.expected }}</span>
                  <span class="muted"> · {{ a.nom }}</span>
                  <span class="muted gloss"> — {{ a.gloss }}</span>
                </div>
              </div>
            }
          </section>
        }

        @if (correctAnswers.length > 0) {
          <section class="review-section">
            <h3 class="review-section__h ok">
              {{ i18n.t('session.correctHeading', { n: correctAnswers.length }) }}
            </h3>
            @for (a of correctAnswers; track $index) {
              <div class="review-card">
                <div class="review-card__head">
                  <b>{{ a.cue }}</b>
                  <span class="meta">{{ a.tags }}</span>
                </div>
                <div class="review-card__line">
                  <span class="ans">{{ a.expected }}</span>
                  <span class="muted"> · {{ a.nom }}</span>
                  <span class="muted gloss"> — {{ a.gloss }}</span>
                  @if (a.typo) {
                    <span class="muted"> · {{ i18n.t('session.typoLabel', { x: '' }) }}</span>
                    <span class="you">{{ a.entered }}</span>
                  }
                  @if (a.caps) {
                    <span class="muted"> · {{ i18n.t('adjektiv.capsLabel') }}</span>
                    <span class="you">{{ a.entered }}</span>
                  }
                </div>
              </div>
            }
          </section>
        }
      </main>
    } @else if (loaded && session) {
      <main class="quiz-shell">
        <div class="quiz-bar">
          <div class="quiz-bar__left">
            <div class="quiz-bar__count">
              {{ position + 1 }}<span> / {{ total }}</span>
            </div>
            <div class="progress">
              <div
                class="progress__fill"
                [style.width.%]="(position / (total || 1)) * 100"
              ></div>
            </div>
          </div>
          <div class="quiz-bar__right" style="display: flex; align-items: center; gap: 14px;">
            <div class="counters">
              <span class="c-ok">✓ {{ session.correct }}</span>
              <span class="c-bad">✗ {{ session.incorrect }}</span>
              <span class="c-skip">↺ {{ session.skipped }}</span>
            </div>
            <button class="btn btn--quiet" type="button" (click)="ruleOpen = true">
              {{ i18n.t('adjektiv.rules.open') }}
            </button>
            <button class="btn btn--quiet" (click)="quit()">
              {{ i18n.t('session.endSession') }}
            </button>
          </div>
        </div>

        @if (current) {
          <article class="qcard" [class.qcard--shake]="shaking">
            <div class="qhead">
              <div class="adj-cue-wrap">
                <div class="qhead__noun adj-cue">
                  <span class="adj-cue__adj">{{ current.adj.base }}</span>
                  <span class="adj-cue__plus" aria-hidden="true">+</span>
                  <span>{{ current.noun.singular }}</span>
                  <app-speak-button [text]="current.noun.singular" size="lg" />
                </div>
                <div class="adj-cue__gloss">{{ current.glossEn }}</div>
              </div>
              <div class="qhead__chips">
                <span class="chip chip--case">
                  <span class="chip__k">{{ chipLabel.case }}</span>
                  <span class="chip__v">{{ caseLabel(current.cell.case) }}</span>
                </span>
                <span class="chip chip--num">
                  <span class="chip__k">{{ chipLabel.num }}</span>
                  <span class="chip__v">{{ numberLabel(current.cell.number) }}</span>
                </span>
                <span class="chip chip--art">
                  <span class="chip__k">{{ chipLabel.cls }}</span>
                  <span class="chip__v">
                    {{ classLabel(current.cell.cls) }}
                    <em class="chip__gloss">{{ determinerHint(current.cell) }}</em>
                  </span>
                </span>
              </div>
            </div>

            <form (submit)="onSubmit($event)">
              <div class="qinput-wrap">
                <input
                  #answerInput
                  type="text"
                  class="qinput"
                  [class.is-typo]="feedback?.typo"
                  [class.is-mismatch]="classMismatch !== null"
                  [(ngModel)]="entered"
                  (ngModelChange)="onEnteredChange()"
                  name="answer"
                  [disabled]="feedback !== null"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  [placeholder]="i18n.t('adjektiv.placeholder')"
                />
                <span class="qkbd" aria-hidden="true">↵ Enter</span>
              </div>

              @if (classMismatch) {
                <div class="mismatch-notice" role="status" aria-live="polite">
                  <div class="mismatch-notice__title">
                    {{ i18n.t('adjektiv.classMismatch.title') }}
                  </div>
                  <div class="mismatch-notice__body">
                    {{ i18n.t('adjektiv.classMismatch.body', {
                      used: classLabel(classMismatch.used),
                      want: classLabel(current.cell.cls)
                    }) }}
                  </div>
                </div>
              }

              @if (feedback === null) {
                <div class="qchars" role="toolbar" aria-label="Insert German character">
                  @for (ch of specialChars; track ch) {
                    <button
                      type="button"
                      class="qchar"
                      (mousedown)="$event.preventDefault()"
                      (click)="insertChar(ch)"
                      [attr.aria-label]="'Insert ' + ch"
                    >{{ ch }}</button>
                  }
                </div>
              }

              <div class="qactions">
                @if (feedback === null) {
                  <button class="btn btn--primary" type="submit">
                    {{ i18n.t('session.submit') }}
                  </button>
                  <button class="btn btn--ghost" type="button" (click)="onSkip()">
                    {{ i18n.t('session.skip') }}
                  </button>
                  <button class="btn btn--ghost" type="button" (click)="onIdk()">
                    {{ i18n.t('session.idk') }}
                  </button>
                  <span class="spacer"></span>
                  <span class="kbd-hint">
                    <span class="kbd">Esc</span> {{ i18n.t('session.kbdSkip') }}
                  </span>
                } @else {
                  <button #nextBtn class="btn btn--primary" type="button" (click)="next()">
                    <span>{{ i18n.t('session.next') }}</span>
                    <span class="arrow" aria-hidden="true">→</span>
                  </button>
                }
              </div>
            </form>

            @if (feedback) {
              <div
                class="feedback"
                [class.feedback--ok]="feedback.result === 'correct' && !feedback.typo && !feedback.caps"
                [class.feedback--typo]="feedback.result === 'correct' && (feedback.typo || feedback.caps)"
                [class.feedback--bad]="feedback.result === 'incorrect'"
                [class.feedback--unk]="feedback.result === 'idk'"
              >
                <div class="feedback__title">
                  @if (feedback.result === 'correct' && feedback.caps) {
                    <span aria-hidden="true">≈</span> {{ i18n.t('adjektiv.result.caps') }}
                  } @else if (feedback.result === 'correct' && feedback.typo) {
                    <span aria-hidden="true">≈</span> {{ i18n.t('session.result.typo') }}
                  } @else if (feedback.result === 'correct') {
                    <span aria-hidden="true">✓</span> {{ i18n.t('session.result.correct') }}
                  } @else if (feedback.result === 'idk') {
                    <span aria-hidden="true">?</span> {{ i18n.t('session.result.idk') }}
                  } @else {
                    <span aria-hidden="true">✗</span> {{ i18n.t('session.result.incorrect') }}
                  }
                </div>
                @if ((feedback.typo || feedback.caps) && feedback.entered) {
                  <div class="feedback__row">
                    {{ i18n.t('session.youWrote') }}
                    <span class="you">{{ feedback.entered }}</span>
                  </div>
                }
                <div class="feedback__row">
                  <b>{{ i18n.t('session.answer') }}</b>
                  <code>{{ feedback.expected }}</code>
                  <app-speak-button [text]="feedback.expected" />
                </div>
                <div class="feedback__row">
                  <b>{{ i18n.t('session.nominativ') }}</b>
                  <code>{{ current.nom }}</code>
                  <app-speak-button [text]="current.nom" />
                </div>
                <div class="feedback__row feedback__row--translation">
                  <b>{{ i18n.t('session.translation') }}</b>
                  <span class="gloss">{{ current.glossEn }}</span>
                </div>
              </div>
            }
          </article>
        }
      </main>
    } @else if (loaded && !session) {
      <main class="page page--narrow">
        <p class="muted">{{ i18n.t('session.notFound') }}</p>
        <button class="btn btn--ghost" (click)="goHome()">{{ i18n.t('session.backToHome') }}</button>
      </main>
    } @else {
      <main class="page page--narrow">
        <p class="muted">{{ i18n.t('session.loading') }}</p>
      </main>
    }
    <app-adj-rule-card [(open)]="ruleOpen" [highlight]="current?.cell ?? null" />
  `,
  styles: [
    `
      :host { display: block; }
      .adj-cue {
        display: inline-flex;
        align-items: center;
        gap: 12px;
      }
      .adj-cue { line-height: 1.25; }
      .adj-cue__adj { color: var(--orange); }
      .adj-cue__plus { color: var(--ink-3); font-weight: 400; }
      .adj-cue-wrap { display: flex; flex-direction: column; gap: 10px; }
      .adj-cue__gloss {
        font-size: 13px;
        line-height: 1.3;
        color: var(--ink-3);
        font-style: italic;
        letter-spacing: 0.01em;
      }
      .chip--art .chip__v { display: inline-flex; align-items: baseline; gap: 8px; }
      .chip__gloss {
        font-style: italic;
        font-weight: 400;
        font-size: 11px;
        color: var(--ink-3, var(--ink-2));
      }
      .ans {
        background: transparent;
        color: var(--ok);
        padding: 0;
        font-weight: 700;
        font-family: var(--font-mono);
        font-size: 13.5px;
      }
      .you {
        background: var(--bg-2);
        padding: 1px 8px;
        color: var(--ink);
        font-family: var(--font-mono);
        font-size: 12.5px;
      }
      .review-card__line .gloss { font-style: italic; }
      .qchars { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
      .qchar {
        font-family: var(--font-mono);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink-2);
        background: var(--bg-2);
        border: 1px solid var(--rule);
        padding: 8px 0;
        cursor: pointer;
        min-width: 40px;
        text-align: center;
        transition:
          color var(--dur-fast) var(--ease-standard),
          border-color var(--dur-fast) var(--ease-standard),
          background var(--dur-fast) var(--ease-standard);
      }
      .qchar:hover { color: var(--ink); border-color: var(--ink); background: var(--bg-3); }
      .qchar:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
      .feedback__row app-speak-button { margin-left: 8px; }
      .feedback__row .gloss { font-style: italic; }
      .qinput.is-mismatch {
        border-color: var(--orange);
        background: rgba(255, 91, 31, 0.08);
      }
      .mismatch-notice {
        margin-top: 14px;
        padding: 12px 14px;
        background: var(--bg-2);
        border-left: 3px solid var(--orange);
        animation: feedback-in 220ms var(--ease-out);
      }
      .mismatch-notice__title {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--orange);
        margin-bottom: 4px;
      }
      .mismatch-notice__body {
        font-family: var(--font-mono);
        font-size: 12.5px;
        color: var(--ink-2);
        letter-spacing: 0.02em;
        line-height: 1.4;
      }
    `,
  ],
})
export class AdjektivSessionComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalog = inject(CatalogService);
  private db = inject(DbService);
  private activity = inject(ActivityService);
  i18n = inject(I18nService);

  @ViewChild('answerInput') answerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('nextBtn') nextBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('backBtn') backBtn?: ElementRef<HTMLButtonElement>;

  session: Session | null = null;
  queue: QueuedCard[] = [];
  answers: AnswerRow[] = [];
  done = false;
  position = 0;
  total = 0;
  current: QueuedCard | null = null;
  entered = '';
  ruleOpen = false;
  feedback: {
    result: AnswerResult;
    expected: string;
    typo?: boolean;
    caps?: boolean;
    entered?: string;
  } | null = null;
  // Set when the answer is the correct phrase for a different declension class
  // (right ending, wrong type) — shake and let them fix it, don't commit.
  classMismatch: { used: AdjClass } | null = null;
  shaking = false;
  private shakeOffTimer: ReturnType<typeof setTimeout> | undefined;
  loaded = false;

  private triggerShake() {
    if (this.shakeOffTimer) clearTimeout(this.shakeOffTimer);
    this.shaking = false;
    setTimeout(() => {
      this.shaking = true;
      this.shakeOffTimer = setTimeout(() => { this.shaking = false; }, 520);
    }, 0);
  }

  readonly chipLabel = { case: 'CASE', num: 'NUM', cls: 'CLASS' };
  readonly specialChars = ['ä', 'Ä', 'ö', 'Ö', 'ü', 'Ü', 'ß'];

  insertChar(ch: string) {
    if (this.feedback !== null) return;
    const input = this.answerInput?.nativeElement;
    const cur = this.entered ?? '';
    if (!input) {
      this.entered = cur + ch;
      return;
    }
    const start = input.selectionStart ?? cur.length;
    const end = input.selectionEnd ?? cur.length;
    this.entered = cur.slice(0, start) + ch + cur.slice(end);
    setTimeout(() => {
      input.focus();
      const pos = start + ch.length;
      input.setSelectionRange(pos, pos);
    }, 0);
  }

  caseLabel(c: string) { return CASE_LABEL[c] ?? c; }
  numberLabel(n: string) { return NUMBER_LABEL[n] ?? n; }
  classLabel(c: string) { return CLASS_LABEL[c] ?? c; }

  // The concrete determiner the answer must use — the piece the class name
  // alone can't tell you. Weak → the definite article, mixed → ein in the
  // singular but the possessive mein in the plural, strong → none.
  determinerHint(cell: AdjCell): string {
    if (cell.cls === 'strong') return 'ohne Artikel';
    if (cell.cls === 'weak') return 'der/die/das';
    return cell.number === 'pl' ? 'mein' : 'ein';
  }

  private buildTags(cell: AdjCell): string {
    return `${this.caseLabel(cell.case)} · ${this.numberLabel(cell.number)} · ${this.classLabel(cell.cls)} (${this.determinerHint(cell)})`;
  }

  private buildCue(adj: AdjectiveEntry, noun: Noun): string {
    return `${adj.base} + ${noun.singular}`;
  }

  // The noun's gender and plural, shown the German way — the nominative form
  // with the definite article, singular / plural ("der Tisch / die Tische").
  // Mirrors the Deklination reference. Plural-only nouns show just the plural.
  private nounNominative(noun: Noun): string {
    if (noun.pluralOnly) return expectedAnswer(noun, 'pl', 'nom', 'def');
    const sg = expectedAnswer(noun, 'sg', 'nom', 'def');
    if (noun.plural === null) return sg;
    const pl = expectedAnswer(noun, 'pl', 'nom', 'def');
    return `${sg} / ${pl}`;
  }

  get correctAnswers(): AnswerRow[] {
    return this.answers.filter((a) => a.result === 'correct');
  }
  get missedAnswers(): AnswerRow[] {
    return this.answers.filter((a) => a.result !== 'correct');
  }
  get wroteText(): string { return this.i18n.t('session.youWroteShort'); }
  get expectedText(): string { return this.i18n.t('session.expectedShort'); }

  @HostListener('window:keydown.enter', ['$event'])
  onEnterKey(ev: KeyboardEvent) {
    if (this.ruleOpen) return;
    if (this.feedback !== null && this.current) {
      ev.preventDefault();
      this.next();
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscapeKey(ev: KeyboardEvent) {
    // While the rule card is open, Esc closes it (handled there) and must not
    // also skip the current card.
    if (this.ruleOpen) return;
    if (!this.current || this.feedback !== null || this.done) return;
    ev.preventDefault();
    this.onSkip();
  }

  async ngOnInit() {
    await this.catalog.init();
    const id = this.route.snapshot.paramMap.get('id')!;
    const sess = await this.db.getSession(id);
    if (!sess) {
      this.loaded = true;
      return;
    }
    this.session = sess;

    if (sess.endedAt !== null) {
      this.done = true;
      this.loaded = true;
      this.focusBack();
      return;
    }

    const cardIds = (await this.db.getMeta<string[]>(`session:${id}:cards`)) ?? [];
    const adjectives = this.catalog.allAdjectives();
    const nounById = this.catalog.nounMap();
    const queue: QueuedCard[] = [];
    for (const cid of cardIds) {
      const cell = parseAdjCellId(cid);
      if (!cell) continue;
      const surface: AdjSurface | null = pickAdjSurface(cell, adjectives, nounById);
      if (!surface) continue;
      queue.push({
        cardId: cid,
        cell,
        adj: surface.adj,
        noun: surface.noun,
        expected: expectedAdjPhrase(surface.adj, surface.noun, cell),
        glossEn: adjPhraseGlossEn(surface.adj, surface.noun, cell),
        nom: this.nounNominative(surface.noun),
      });
    }
    this.queue = queue;
    this.total = queue.length;
    this.position = sess.presented;
    this.current = queue[this.position] ?? null;
    this.loaded = true;
    if (!this.current) {
      await this.endSession();
      return;
    }
    this.focusInput();
  }

  ngAfterViewInit() {}

  private focusInput() {
    setTimeout(() => this.answerInput?.nativeElement.focus(), 0);
  }
  private focusNext() {
    setTimeout(() => this.nextBtn?.nativeElement.focus(), 0);
  }
  private focusBack() {
    setTimeout(() => this.backBtn?.nativeElement.focus(), 0);
  }

  async onSubmit(ev: Event) {
    ev.preventDefault();
    if (!this.current || !this.session) return;
    const check = checkAdjAnswer(this.entered, this.current.expected);
    if (check.kind === 'wrong') {
      // Right ending, wrong class? Don't lock it in — shake and reprompt so
      // they can switch to this card's declension type.
      const other = detectAdjClassMismatch(
        this.entered,
        this.current.adj,
        this.current.noun,
        this.current.cell,
      );
      if (other) {
        this.classMismatch = { used: other };
        this.triggerShake();
        this.focusInput();
        return;
      }
    }
    this.classMismatch = null;
    const result: AnswerResult = check.kind === 'wrong' ? 'incorrect' : 'correct';
    const flag = check.kind === 'typo' ? 'typo' : check.kind === 'caps' ? 'caps' : null;
    await this.recordResult(result, flag);
  }

  onEnteredChange() {
    // Any edit clears the mismatch warning so it doesn't linger while fixing.
    if (this.classMismatch !== null) this.classMismatch = null;
  }

  async onIdk() {
    if (!this.current) return;
    await this.recordResult('idk');
  }

  async onSkip() {
    if (!this.current || !this.session) return;
    const cur = this.current;
    const restCount = this.queue.length - this.position - 1;
    const offset = Math.min(restCount, 5 + Math.floor(Math.random() * 6));
    this.queue.splice(this.position, 1);
    const insertAt = this.position + offset;
    this.queue.splice(insertAt, 0, cur);
    this.session.skipped++;
    await this.activity.log(this.answerEvent(cur, '', 'skipped'));
    await this.db.putSession(this.session);
    this.current = this.queue[this.position] ?? null;
    this.entered = '';
    this.feedback = null;
    this.focusInput();
  }

  private answerEvent(cur: QueuedCard, entered: string, result: AnswerResult, typo = false) {
    return {
      kind: 'answer' as const,
      ts: Date.now(),
      sessionId: this.session!.id,
      cardId: cur.cardId,
      prompt: {
        singular: cur.noun.singular,
        plural: cur.noun.plural,
        gender: cur.noun.gender,
        case: cur.cell.case,
        number: cur.cell.number,
        articleType: 'def' as const,
        cls: cur.cell.cls,
        adjective: cur.adj.base,
      },
      entered,
      expected: cur.expected,
      result,
      ...(typo ? { typo: true } : {}),
    };
  }

  private async recordResult(
    result: AnswerResult,
    flag: 'typo' | 'caps' | null = null,
  ) {
    if (!this.current || !this.session) return;
    const typo = flag === 'typo';
    const caps = flag === 'caps';
    const cur = this.current;
    const now = Date.now();
    const prevState =
      (await this.db.getCardState(cur.cardId)) ?? newCardState(cur.cardId);
    const nextState = applyResult(prevState, result, now);
    await this.db.putCardState(nextState);

    if (result === 'correct') this.session.correct++;
    else if (result === 'incorrect') this.session.incorrect++;
    else if (result === 'idk') this.session.idk++;
    this.session.presented++;
    await this.db.putSession(this.session);

    await this.activity.log(this.answerEvent(cur, this.entered, result, typo));

    this.feedback = {
      result,
      expected: cur.expected,
      ...(typo || caps ? { entered: this.entered.trim() } : {}),
      ...(typo ? { typo: true } : {}),
      ...(caps ? { caps: true } : {}),
    };
    this.answers.push({
      cue: this.buildCue(cur.adj, cur.noun),
      tags: this.buildTags(cur.cell),
      entered: this.entered.trim(),
      expected: cur.expected,
      gloss: cur.glossEn,
      nom: cur.nom,
      result,
      typo,
      caps,
    });
    this.focusNext();
  }

  async next() {
    if (!this.session) return;
    this.position++;
    this.entered = '';
    this.feedback = null;
    if (this.position >= this.queue.length) {
      await this.endSession();
      return;
    }
    this.current = this.queue[this.position];
    this.focusInput();
  }

  async endSession() {
    if (!this.session || this.done) return;
    this.session.endedAt = Date.now();
    await this.db.putSession(this.session);
    await this.activity.log({
      kind: 'session_end',
      ts: this.session.endedAt,
      sessionId: this.session.id,
      summary: {
        presented: this.session.presented,
        correct: this.session.correct,
        incorrect: this.session.incorrect,
        idk: this.session.idk,
        skipped: this.session.skipped,
      },
    });
    this.feedback = null;
    this.current = null;
    this.done = true;
    this.focusBack();
  }

  async quit() {
    await this.endSession();
  }

  goHome() { this.router.navigate(['/adjektiv']); }
}
