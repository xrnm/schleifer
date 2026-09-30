import { Component, ElementRef, HostListener, ViewChild, effect, inject, input, model } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { AdjClass, CaseT, Gender } from '../models/types';
import { AdjCell, adjectiveEnding } from '../core/adjective';

interface EndingRow {
  case: string;
  caseKey: CaseT;
  m: string;
  f: string;
  n: string;
  pl: string;
}
interface ClassBlock {
  key: AdjClass;
  name: string;
  trigger: string;
  rows: EndingRow[];
}

const CLASSES: { key: AdjClass; name: string; trigger: string }[] = [
  { key: 'weak', name: 'schwach', trigger: 'nach der / die / das' },
  { key: 'mixed', name: 'gemischt', trigger: 'nach ein / kein / mein' },
  { key: 'strong', name: 'stark', trigger: 'ohne Artikel' },
];
const CASES: { key: CaseT; label: string }[] = [
  { key: 'nom', label: 'Nominativ' },
  { key: 'acc', label: 'Akkusativ' },
  { key: 'dat', label: 'Dativ' },
];

function end(cls: AdjClass, caseT: CaseT, gender: Gender): string {
  return '-' + adjectiveEnding({ cls, number: 'sg', case: caseT, gender });
}
function endPl(cls: AdjClass, caseT: CaseT): string {
  return '-' + adjectiveEnding({ cls, number: 'pl', case: caseT });
}

/**
 * Reviewable reference: the full adjective-ending table (schwach / gemischt /
 * stark × case × gender). Endings are pulled from the engine's own table, so
 * the card can never disagree with the grader. Open state is a two-way model.
 */
@Component({
  selector: 'app-adj-rule-card',
  standalone: true,
  template: `
    @if (open()) {
      <div class="rc-backdrop" (click)="close()">
        <div
          class="rc-panel"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.t('adjektiv.rules.title')"
          (click)="$event.stopPropagation()"
        >
          <header class="rc-head">
            <div>
              <span class="rc-eyebrow">{{ i18n.t('adjektiv.eyebrow') }}</span>
              <h2 class="rc-title">{{ i18n.t('adjektiv.rules.title') }}</h2>
            </div>
            <button #closeBtn class="rc-x" type="button" (click)="close()" [attr.aria-label]="i18n.t('adjektiv.rules.close')">✕</button>
          </header>

          <p class="rc-intro">{{ i18n.t('adjektiv.rules.intro') }}</p>
          @if (highlight()) {
            <p class="rc-current">{{ i18n.t('adjektiv.rules.current') }}</p>
          }

          <div class="rc-tables">
            @for (b of blocks; track b.key) {
              <section class="rc-block">
                <div class="rc-block__h">
                  <span class="rc-block__name">{{ b.name }}</span>
                  <span class="rc-block__trig">{{ b.trigger }}</span>
                </div>
                <table class="rc-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>m</th><th>f</th><th>n</th><th>Pl</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of b.rows; track r.case) {
                      <tr>
                        <th class="rc-case">{{ r.case }}</th>
                        <td [class.rc-hit]="isActive(b.key, r.caseKey, 'm')">{{ r.m }}</td>
                        <td [class.rc-hit]="isActive(b.key, r.caseKey, 'f')">{{ r.f }}</td>
                        <td [class.rc-hit]="isActive(b.key, r.caseKey, 'n')">{{ r.n }}</td>
                        <td [class.rc-hit]="isActive(b.key, r.caseKey, 'pl')">{{ r.pl }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            }
          </div>

          <p class="rc-note">{{ i18n.t('adjektiv.rules.note') }}</p>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .rc-backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 40px 16px;
        overflow-y: auto;
        animation: rc-fade 140ms var(--ease-standard, ease-out);
      }
      @keyframes rc-fade { from { opacity: 0; } to { opacity: 1; } }
      .rc-panel {
        background: var(--bg);
        border: 1px solid var(--rule);
        border-top: 3px solid var(--orange);
        max-width: 760px;
        width: 100%;
        padding: 22px 24px 24px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        animation: rc-rise 180ms var(--ease-standard, ease-out);
      }
      @keyframes rc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .rc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .rc-eyebrow {
        font-family: var(--font-mono);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .rc-title { margin: 4px 0 0; font-size: 20px; }
      .rc-x {
        flex: 0 0 auto;
        background: transparent;
        border: 1px solid var(--rule);
        color: var(--ink-2);
        width: 34px;
        height: 34px;
        cursor: pointer;
        font-size: 15px;
        line-height: 1;
        transition: color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
      }
      .rc-x:hover { color: var(--orange); border-color: var(--orange); }
      .rc-x:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
      .rc-intro { color: var(--ink-2); font-size: 13.5px; line-height: 1.5; margin: 14px 0 10px; }
      .rc-current {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--orange);
        margin: 0 0 16px;
      }
      .rc-table td.rc-hit {
        background: var(--orange);
        color: var(--bg);
        font-weight: 700;
        box-shadow: inset 0 0 0 1px var(--orange);
      }
      .rc-tables { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      @media (max-width: 640px) { .rc-tables { grid-template-columns: 1fr; } }
      .rc-block__h { margin-bottom: 8px; }
      .rc-block__name {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--orange);
      }
      .rc-block__trig {
        display: block;
        font-family: var(--font-mono);
        font-size: 10.5px;
        letter-spacing: 0.04em;
        color: var(--ink-3);
        margin-top: 2px;
      }
      .rc-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 12.5px; }
      .rc-table th, .rc-table td { border: 1px solid var(--rule); padding: 6px 8px; text-align: center; }
      .rc-table thead th { color: var(--ink-3); font-weight: 700; background: var(--bg-2); }
      .rc-table td { color: var(--ink); }
      .rc-case { color: var(--ink-2); text-align: left !important; font-weight: 700; }
      .rc-note {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--rule);
        color: var(--ink-3);
        font-size: 12px;
        line-height: 1.5;
      }
    `,
  ],
})
export class AdjRuleCardComponent {
  i18n = inject(I18nService);
  readonly open = model(false);
  // The current card's cell, so its row/column can be highlighted. Null on the
  // home page, where there's no active card.
  readonly highlight = input<AdjCell | null>(null);

  @ViewChild('closeBtn') closeBtn?: ElementRef<HTMLButtonElement>;

  readonly blocks: ClassBlock[] = CLASSES.map((c) => ({
    ...c,
    rows: CASES.map((cs) => ({
      case: cs.label,
      caseKey: cs.key,
      m: end(c.key, cs.key, 'm'),
      f: end(c.key, cs.key, 'f'),
      n: end(c.key, cs.key, 'n'),
      pl: endPl(c.key, cs.key),
    })),
  }));

  // True for the single cell matching the current card: same class + case, and
  // either the matching gender column (singular) or the plural column.
  isActive(cls: AdjClass, caseKey: CaseT, col: Gender | 'pl'): boolean {
    const h = this.highlight();
    if (!h || h.cls !== cls || h.case !== caseKey) return false;
    return col === 'pl' ? h.number === 'pl' : h.number === 'sg' && h.gender === col;
  }

  constructor() {
    // Move focus to the close button when the card opens, for keyboard users.
    effect(() => {
      if (this.open()) setTimeout(() => this.closeBtn?.nativeElement.focus(), 0);
    });
  }

  close() { this.open.set(false); }

  @HostListener('window:keydown.escape', ['$event'])
  onEscape(ev: KeyboardEvent) {
    if (!this.open()) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    this.close();
  }
}
