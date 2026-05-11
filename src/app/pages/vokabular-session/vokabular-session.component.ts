import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivityService } from '../../core/activity.service';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService } from '../../core/i18n.service';
import { applyResult, newCardState } from '../../core/srs';
import {
  buildTranslationQuestion,
  nounIdFromTranslationCardId,
} from '../../core/translation';
import {
  AnswerResult,
  Noun,
  Session,
  TranslationQuestion,
} from '../../models/types';

interface QueuedQuestion {
  cardId: string;
  noun: Noun;
  question: TranslationQuestion;
}

interface AnswerRow {
  prompt: string;
  correct: string;
  picked: string;
  result: AnswerResult;
}

@Component({
  selector: 'app-vokabular-session',
  standalone: true,
  imports: [],
  template: `
    @if (loaded && session && done) {
      <main class="page page--narrow">
        <span class="eyebrow">{{ i18n.t('eyebrow.sessionComplete') }}</span>
        <h1>{{ i18n.t('vokabular.summaryH1') }}</h1>
        <div class="review-summary">
          <span class="c-ok">✓ {{ i18n.t('session.stats.correct', { n: session.correct }) }}</span>
          <span class="c-bad">✗ {{ i18n.t('session.stats.wrong', { n: session.incorrect }) }}</span>
          @if (session.idk > 0) {
            <span class="c-unk">? {{ i18n.t('session.stats.unknown', { n: session.idk }) }}</span>
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
                  <b>{{ a.prompt }}</b>
                </div>
                <div class="review-card__line">
                  <span class="muted">{{ wroteText }}</span>
                  <span class="you">{{ a.picked || '—' }}</span>
                  <span class="muted"> · {{ expectedText }}</span>
                  <span class="ans">{{ a.correct }}</span>
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
                  <b>{{ a.prompt }}</b>
                </div>
                <div class="review-card__line">
                  <span class="ans">{{ a.correct }}</span>
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
            </div>
            <button class="btn btn--quiet" (click)="quit()">
              {{ i18n.t('session.endSession') }}
            </button>
          </div>
        </div>

        @if (current) {
          <article class="qcard">
            <div class="qhead qhead--centered">
              <div class="vk-dirhint">
                {{ current.question.direction === 'de->en'
                  ? i18n.t('vokabular.prompt.de')
                  : i18n.t('vokabular.prompt.en') }}
              </div>
              <div class="qhead__noun vk-prompt">{{ current.question.prompt }}</div>
            </div>

            <div class="vk-choices">
              @for (choice of current.question.choices; track choice; let i = $index) {
                <button
                  type="button"
                  class="vk-choice"
                  [class.is-correct]="feedback !== null && i === current.question.answerIndex"
                  [class.is-wrong]="feedback !== null && i === pickedIndex && i !== current.question.answerIndex"
                  [disabled]="feedback !== null"
                  (click)="onPick(i)"
                >
                  <span class="vk-choice__idx">{{ choiceLetter(i) }}</span>
                  <span class="vk-choice__txt">{{ choice }}</span>
                </button>
              }
            </div>

            @if (feedback) {
              <div
                class="feedback"
                [class.feedback--ok]="feedback.result === 'correct'"
                [class.feedback--bad]="feedback.result === 'incorrect'"
              >
                <div class="feedback__title">
                  @if (feedback.result === 'correct') {
                    <span aria-hidden="true">✓</span> {{ i18n.t('vokabular.result.correct') }}
                  } @else {
                    <span aria-hidden="true">✗</span> {{ i18n.t('vokabular.result.incorrect') }}
                  }
                </div>
                <div class="feedback__row">
                  <b>{{ i18n.t('vokabular.answerLabel') }}</b>
                  <code>{{ feedback.expected }}</code>
                </div>
              </div>

              <div class="qactions" style="margin-top: 14px;">
                <button #nextBtn class="btn btn--primary" type="button" (click)="next()">
                  <span>{{ i18n.t('session.next') }}</span>
                  <span class="arrow" aria-hidden="true">→</span>
                </button>
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
      .qhead--centered { align-items: center; text-align: center; }
      .vk-dirhint {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 8px;
      }
      .vk-prompt {
        margin-bottom: 16px;
      }
      .vk-choices {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 8px;
      }
      @media (max-width: 720px) {
        .vk-choices { grid-template-columns: 1fr; }
      }
      .vk-choice {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        text-align: left;
        background: var(--bg-2);
        border: 1px solid var(--rule);
        color: var(--ink);
        font-family: var(--font-sans);
        font-size: 15px;
        line-height: 1.3;
        cursor: pointer;
        border-radius: 0;
        transition:
          color var(--dur-fast) var(--ease-standard),
          background var(--dur-fast) var(--ease-standard),
          border-color var(--dur-fast) var(--ease-standard);
      }
      .vk-choice:hover:not(:disabled):not(.is-correct):not(.is-wrong) {
        border-color: var(--orange);
        background: var(--bg-3);
      }
      .vk-choice:focus-visible {
        outline: 2px solid var(--orange);
        outline-offset: 2px;
      }
      .vk-choice:disabled { cursor: default; }
      .vk-choice.is-correct {
        border-color: var(--ok);
        background: rgba(122, 209, 154, 0.08);
        color: var(--ok);
      }
      .vk-choice.is-wrong {
        border-color: var(--bad);
        background: rgba(255, 91, 31, 0.08);
        color: var(--bad);
      }
      .vk-choice__idx {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 12px;
        color: var(--ink-3);
        min-width: 16px;
      }
      .vk-choice.is-correct .vk-choice__idx { color: var(--ok); }
      .vk-choice.is-wrong .vk-choice__idx { color: var(--bad); }
      .vk-choice__txt { flex: 1; }
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
    `,
  ],
})
export class VokabularSessionComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalog = inject(CatalogService);
  private db = inject(DbService);
  private activity = inject(ActivityService);
  i18n = inject(I18nService);

  @ViewChild('nextBtn') nextBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('backBtn') backBtn?: ElementRef<HTMLButtonElement>;

  session: Session | null = null;
  queue: QueuedQuestion[] = [];
  answers: AnswerRow[] = [];
  done = false;
  position = 0;
  total = 0;
  current: QueuedQuestion | null = null;
  pickedIndex: number | null = null;
  feedback: { result: AnswerResult; expected: string } | null = null;
  loaded = false;

  get correctAnswers(): AnswerRow[] {
    return this.answers.filter((a) => a.result === 'correct');
  }
  get missedAnswers(): AnswerRow[] {
    return this.answers.filter((a) => a.result !== 'correct');
  }
  get wroteText(): string { return this.i18n.lang() === 'de' ? 'gewählt' : 'picked'; }
  get expectedText(): string { return this.i18n.lang() === 'de' ? 'richtig' : 'correct'; }

  choiceLetter(i: number): string {
    return String.fromCharCode('A'.charCodeAt(0) + i);
  }

  @HostListener('window:keydown.enter', ['$event'])
  onEnterKey(ev: KeyboardEvent) {
    if (this.feedback !== null && this.current) {
      ev.preventDefault();
      this.next();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (!this.current || this.feedback !== null || this.done) return;
    const key = ev.key.toLowerCase();
    const idx = key === '1' ? 0 : key === '2' ? 1 : key === '3' ? 2 : key === '4' ? 3
      : key === 'a' ? 0 : key === 'b' ? 1 : key === 'c' ? 2 : key === 'd' ? 3 : -1;
    if (idx >= 0 && idx < this.current.question.choices.length) {
      ev.preventDefault();
      this.onPick(idx);
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
    if (sess.endedAt !== null) {
      this.done = true;
      this.loaded = true;
      this.focusBack();
      return;
    }
    const cardIds = (await this.db.getMeta<string[]>(`session:${id}:cards`)) ?? [];
    const nouns = this.catalog.allNouns();
    const queue: QueuedQuestion[] = [];
    for (const cid of cardIds) {
      const nounId = nounIdFromTranslationCardId(cid);
      const noun = this.catalog.noun(nounId);
      if (!noun || !noun.english) continue;
      const question = buildTranslationQuestion(noun, nouns);
      queue.push({ cardId: cid, noun, question });
    }
    this.queue = queue;
    this.total = queue.length;
    this.position = sess.presented;
    this.current = queue[this.position] ?? null;
    this.loaded = true;
    if (!this.current) {
      await this.endSession();
    }
  }

  ngAfterViewInit() {}

  private focusNext() {
    setTimeout(() => this.nextBtn?.nativeElement.focus(), 0);
  }
  private focusBack() {
    setTimeout(() => this.backBtn?.nativeElement.focus(), 0);
  }

  async onPick(i: number) {
    if (!this.current || !this.session || this.feedback !== null) return;
    this.pickedIndex = i;
    const isCorrect = i === this.current.question.answerIndex;
    const result: AnswerResult = isCorrect ? 'correct' : 'incorrect';
    const cur = this.current;
    const now = Date.now();
    const prevState =
      (await this.db.getCardState(cur.cardId)) ?? newCardState(cur.cardId);
    const nextState = applyResult(prevState, result, now);
    await this.db.putCardState(nextState);

    if (result === 'correct') this.session.correct++;
    else this.session.incorrect++;
    this.session.presented++;
    await this.db.putSession(this.session);

    await this.activity.log({
      kind: 'answer',
      ts: now,
      sessionId: this.session.id,
      cardId: cur.cardId,
      prompt: {
        singular: cur.noun.singular,
        plural: cur.noun.plural,
        gender: cur.noun.gender,
        case: 'nom',
        number: 'sg',
        articleType: 'def',
      },
      entered: cur.question.choices[i] ?? '',
      expected: cur.question.choices[cur.question.answerIndex] ?? '',
      result,
    });

    this.feedback = {
      result,
      expected: cur.question.choices[cur.question.answerIndex] ?? '',
    };
    this.answers.push({
      prompt: cur.question.prompt,
      correct: cur.question.choices[cur.question.answerIndex] ?? '',
      picked: cur.question.choices[i] ?? '',
      result,
    });
    this.focusNext();
  }

  async next() {
    if (!this.session) return;
    this.position++;
    this.pickedIndex = null;
    this.feedback = null;
    if (this.position >= this.queue.length) {
      await this.endSession();
      return;
    }
    this.current = this.queue[this.position];
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

  goHome() { this.router.navigate(['/vokabular']); }
}
