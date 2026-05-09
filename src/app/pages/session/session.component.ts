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
import { checkAnswer, expectedAnswer } from '../../core/declension';
import { applyResult, newCardState } from '../../core/srs';
import {
  AnswerResult,
  Card,
  Noun,
  Rule,
  Session,
} from '../../models/types';

interface QueuedCard {
  card: Card;
  noun: Noun;
}

interface AnswerRow {
  noun: string;
  tags: string;
  entered: string;
  expected: string;
  result: AnswerResult;
  typo: boolean;
  rules: Rule[];
}

const CASE_LABEL: Record<string, string> = {
  nom: 'Nominativ',
  acc: 'Akkusativ',
  dat: 'Dativ',
};
const NUMBER_LABEL: Record<string, string> = { sg: 'Singular', pl: 'Plural' };
const ARTICLE_LABEL: Record<string, string> = {
  def: 'bestimmt',
  indef: 'unbestimmt',
};

@Component({
  selector: 'app-session',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (loaded && session && done) {
      <main class="page page--narrow">
        <span class="eyebrow">{{ i18n.t('eyebrow.sessionComplete') }}</span>
        <h1>{{ i18n.t('session.summaryH1') }}</h1>
        <div class="review-summary">
          <span class="c-ok">✓ {{ i18n.t('session.stats.correct', { n: session.correct }) }}</span>
          <span class="c-bad">✗ {{ i18n.t('session.stats.wrong', { n: session.incorrect }) }}</span>
          <span class="c-unk">? {{ i18n.t('session.stats.unknown', { n: session.idk }) }}</span>
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
                  <b>{{ a.noun }}</b>
                  <span class="meta">{{ a.tags }}</span>
                </div>
                <div class="review-card__line">
                  @if (a.result === 'idk') {
                    {{ i18n.t('session.didntKnow', { x: '' }) }}
                    <span class="ans">{{ a.expected }}</span>
                  } @else {
                    <span class="muted">{{ wroteText }}</span>
                    <span class="you">{{ a.entered || '—' }}</span>
                    <span class="muted"> · {{ expectedText }}</span>
                    <span class="ans">{{ a.expected }}</span>
                  }
                </div>
                @if (firstRule(a); as r) {
                  <div class="rule-line" style="margin-top: 10px;">
                    <span class="rid">{{ i18n.t('session.rule', { n: r.id }) }}</span>
                    <div>{{ i18n.ruleFeedback(r.id, r.feedbackMessage || r.title) }}</div>
                  </div>
                }
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
                  <b>{{ a.noun }}</b>
                  <span class="meta">{{ a.tags }}</span>
                </div>
                <div class="review-card__line">
                  <span class="ans">{{ a.expected }}</span>
                  @if (a.typo) {
                    <span class="muted"> · {{ i18n.t('session.typoLabel', { x: '' }) }}</span>
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
              <span class="c-unk">? {{ session.idk }}</span>
              <span class="c-skip">↺ {{ session.skipped }}</span>
            </div>
            <button class="btn btn--quiet" (click)="quit()">
              {{ i18n.t('session.endSession') }}
            </button>
          </div>
        </div>

        @if (current) {
          <article class="qcard">
            <div class="qhead">
              <div class="qhead__noun">{{ current.noun.singular }}</div>
              <div class="qhead__chips">
                <span class="chip chip--case">
                  <span class="chip__k">{{ chipLabel.case }}</span>
                  <span class="chip__v">{{ caseLabel(current.card.case) }}</span>
                </span>
                <span class="chip chip--num">
                  <span class="chip__k">{{ chipLabel.num }}</span>
                  <span class="chip__v">{{ numberLabel(current.card.number) }}</span>
                </span>
                <span class="chip chip--art">
                  <span class="chip__k">{{ chipLabel.art }}</span>
                  <span class="chip__v">{{ articleLabel(current.card.articleType) }}</span>
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
                  [(ngModel)]="entered"
                  name="answer"
                  [disabled]="feedback !== null"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  [placeholder]="i18n.t('session.placeholder')"
                />
                <span class="qkbd" aria-hidden="true">↵ Enter</span>
              </div>

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
                [class.feedback--ok]="feedback.result === 'correct' && !feedback.typo"
                [class.feedback--typo]="feedback.result === 'correct' && feedback.typo"
                [class.feedback--bad]="feedback.result === 'incorrect'"
                [class.feedback--unk]="feedback.result === 'idk'"
              >
                <div class="feedback__title">
                  @if (feedback.result === 'correct' && feedback.typo) {
                    <span aria-hidden="true">≈</span> {{ i18n.t('session.result.typo') }}
                  } @else if (feedback.result === 'correct') {
                    <span aria-hidden="true">✓</span> {{ i18n.t('session.result.correct') }}
                  } @else if (feedback.result === 'idk') {
                    <span aria-hidden="true">?</span> {{ i18n.t('session.result.idk') }}
                  } @else {
                    <span aria-hidden="true">✗</span> {{ i18n.t('session.result.incorrect') }}
                  }
                </div>
                @if (feedback.typo && feedback.entered) {
                  <div class="feedback__row">
                    {{ i18n.t('session.youWrote') }}
                    <span class="you">{{ feedback.entered }}</span>
                  </div>
                }
                <div class="feedback__row">
                  <b>{{ i18n.t('session.answer') }}</b>
                  <code>{{ feedback.expected }}</code>
                </div>
                @if (current.noun.english) {
                  <div class="feedback__row gloss">{{ current.noun.english }}</div>
                }
                <div class="feedback__row">
                  <b>{{ i18n.t('session.nominativ') }}</b>
                  <code>{{ nominativeForm(current.noun) }}</code>
                </div>
                @if (primaryFeedbackRule(); as r) {
                  <div class="rule-line">
                    <span class="rid">{{ i18n.t('session.rule', { n: r.id }) }}</span>
                    <div>{{ i18n.ruleFeedback(r.id, r.feedbackMessage || r.title) }}</div>
                  </div>
                }
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
  `,
  styles: [
    `
      :host { display: block; }
      .ans {
        background: transparent;
        color: var(--ok);
        padding: 0;
        border-radius: 0;
        font-weight: 700;
        font-family: var(--font-mono);
        font-size: 13.5px;
      }
      .you {
        background: var(--bg-2);
        padding: 1px 8px;
        border-radius: 0;
        color: var(--ink);
        font-family: var(--font-mono);
        font-size: 12.5px;
      }
    `,
  ],
})
export class SessionComponent implements OnInit, AfterViewInit {
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
  feedback: {
    result: AnswerResult;
    expected: string;
    typo?: boolean;
    entered?: string;
    rules?: Rule[];
  } | null = null;
  loaded = false;

  readonly chipLabel = { case: 'CASE', num: 'NUM', art: 'ART' };

  caseLabel(c: string) { return CASE_LABEL[c] ?? c; }
  numberLabel(n: string) { return NUMBER_LABEL[n] ?? n; }
  articleLabel(a: string) { return ARTICLE_LABEL[a] ?? a; }

  get correctAnswers(): AnswerRow[] {
    return this.answers.filter((a) => a.result === 'correct');
  }
  get missedAnswers(): AnswerRow[] {
    return this.answers.filter((a) => a.result !== 'correct');
  }

  primaryFeedbackRule(): Rule | null {
    return this.feedback?.rules?.[0] ?? null;
  }
  firstRule(a: AnswerRow): Rule | null {
    return a.rules[0] ?? null;
  }

  get wroteText(): string { return this.i18n.lang() === 'de' ? 'geschrieben' : 'wrote'; }
  get expectedText(): string { return this.i18n.lang() === 'de' ? 'erwartet' : 'expected'; }

  nominativeForm(noun: Noun): string {
    if (noun.pluralOnly) return expectedAnswer(noun, 'pl', 'nom', 'def');
    const sg = expectedAnswer(noun, 'sg', 'nom', 'def');
    if (noun.plural === null) return sg;
    const pl = expectedAnswer(noun, 'pl', 'nom', 'def');
    return `${sg} / ${pl}`;
  }

  @HostListener('window:keydown.enter', ['$event'])
  onEnterKey(ev: KeyboardEvent) {
    // When feedback is showing, Enter advances. The form's normal submit
    // already covers Enter while typing (input has focus, button[type=submit]).
    if (this.feedback !== null && this.current) {
      ev.preventDefault();
      this.next();
    }
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

    // Already-completed session — show summary built from past events.
    if (sess.endedAt !== null) {
      await this.loadPastAnswers(id);
      this.done = true;
      this.loaded = true;
      this.focusBack();
      return;
    }

    const cardIds = (await this.db.getMeta<string[]>(`session:${id}:cards`)) ?? [];
    const queue: QueuedCard[] = [];
    for (const cid of cardIds) {
      const card = this.catalog.card(cid);
      if (!card) continue;
      const noun = this.catalog.noun(card.nounId);
      if (!noun) continue;
      queue.push({ card, noun });
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

  private async loadPastAnswers(sessionId: string) {
    const events = await this.db.getEventsBySession(sessionId);
    const byCard = new Map<string, AnswerRow>();
    for (const ev of events) {
      if (ev.kind !== 'answer') continue;
      if (ev.result === 'skipped') continue;
      const card = this.catalog.card(ev.cardId);
      const noun = card ? this.catalog.noun(card.nounId) : undefined;
      const primary = noun ? this.catalog.primaryRuleFor(noun) : undefined;
      const helpfulRule = primary && primary.id !== 99 ? primary : undefined;
      // Latest event for each card wins (events come back in id order).
      byCard.set(ev.cardId, {
        noun: ev.prompt.singular,
        tags: `${this.caseLabel(ev.prompt.case)} · ${this.numberLabel(ev.prompt.number)} · ${this.articleLabel(ev.prompt.articleType)}`,
        entered: ev.entered,
        expected: ev.expected,
        result: ev.result,
        typo: ev.typo === true,
        rules: helpfulRule ? [helpfulRule] : [],
      });
    }
    this.answers = [...byCard.values()];
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
    const check = checkAnswer(
      this.entered,
      this.current.card.expected,
      this.current.noun,
    );
    const result: AnswerResult = check.kind === 'wrong' ? 'incorrect' : 'correct';
    await this.recordResult(result, check.kind === 'typo');
  }

  async onIdk() {
    if (!this.current) return;
    await this.recordResult('idk');
  }

  async onSkip() {
    if (!this.current || !this.session) return;
    // Move current to a position 5–10 cards from now (if possible) and re-render.
    const cur = this.current;
    const restCount = this.queue.length - this.position - 1;
    const offset = Math.min(restCount, 5 + Math.floor(Math.random() * 6));
    this.queue.splice(this.position, 1);
    const insertAt = this.position + offset;
    this.queue.splice(insertAt, 0, cur);
    this.session.skipped++;
    await this.activity.log({
      kind: 'answer',
      ts: Date.now(),
      sessionId: this.session.id,
      cardId: cur.card.id,
      prompt: {
        singular: cur.noun.singular,
        plural: cur.noun.plural,
        gender: cur.noun.gender,
        case: cur.card.case,
        number: cur.card.number,
        articleType: cur.card.articleType,
      },
      entered: '',
      expected: cur.card.expected,
      result: 'skipped',
    });
    await this.db.putSession(this.session);
    this.current = this.queue[this.position] ?? null;
    this.entered = '';
    this.feedback = null;
    this.focusInput();
  }

  private async recordResult(result: AnswerResult, typo = false) {
    if (!this.current || !this.session) return;
    const cur = this.current;
    const now = Date.now();
    const prevState =
      (await this.db.getCardState(cur.card.id)) ?? newCardState(cur.card.id);
    const nextState = applyResult(prevState, result, now);
    await this.db.putCardState(nextState);

    if (result === 'correct') this.session.correct++;
    else if (result === 'incorrect') this.session.incorrect++;
    else if (result === 'idk') this.session.idk++;
    this.session.presented++;
    await this.db.putSession(this.session);

    await this.activity.log({
      kind: 'answer',
      ts: now,
      sessionId: this.session.id,
      cardId: cur.card.id,
      prompt: {
        singular: cur.noun.singular,
        plural: cur.noun.plural,
        gender: cur.noun.gender,
        case: cur.card.case,
        number: cur.card.number,
        articleType: cur.card.articleType,
      },
      entered: this.entered,
      expected: cur.card.expected,
      result,
      ...(typo ? { typo: true } : {}),
    });
    const primary = this.catalog.primaryRuleFor(cur.noun);
    // Rule 99 is the "no dependable general rule" catch-all — suppress it
    // so we don't tell users "memorize with article" on every miss.
    const helpfulRule = primary && primary.id !== 99 ? primary : undefined;
    const showRule = result !== 'correct' && helpfulRule !== undefined;
    this.feedback = {
      result,
      expected: cur.card.expected,
      ...(typo ? { typo: true, entered: this.entered.trim() } : {}),
      ...(showRule ? { rules: [helpfulRule] } : {}),
    };
    this.answers.push({
      noun: cur.noun.singular,
      tags: `${this.caseLabel(cur.card.case)} · ${this.numberLabel(cur.card.number)} · ${this.articleLabel(cur.card.articleType)}`,
      entered: this.entered.trim(),
      expected: cur.card.expected,
      result,
      typo,
      rules: helpfulRule ? [helpfulRule] : [],
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

  goHome() { this.router.navigate(['/']); }
}
