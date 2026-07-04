import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChildren, QueryList, ElementRef, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { CatalogService } from '../../core/catalog.service';
import { I18nService } from '../../core/i18n.service';
import { Noun, Rule } from '../../models/types';

interface CaseSection {
  id: string;
  title: string;
  htmlSafe: SafeHtml;
}

type TabId = 'cases' | 'articles' | 'adjectives' | 'plurals' | 'gender';

interface Tab {
  id: TabId;
  sectionIds: string[];
  showRules?: boolean;
}

const TABS: Tab[] = [
  {
    id: 'cases',
    sectionIds: [
      'the-four-german-cases',
      'common-case-signals',
      'common-two-way-prepositions',
      'mnemonic-patterns',
      'high-level-pattern',
    ],
  },
  {
    id: 'articles',
    sectionIds: [
      'terminology',
      'definite-articles',
      'indefinite-articles',
      'negative-indefinite-article',
      'possessive-articles',
      'teaching-tip',
    ],
  },
  {
    id: 'adjectives',
    sectionIds: [
      'adjective-endings-after-definite-articles',
      'adjective-endings-after-indefinite-articles',
      'no-article-adjective-endings',
    ],
  },
  {
    id: 'plurals',
    sectionIds: [
      'plural-quick-shortcut',
      'plural-cheat-sheet',
      'plural-heuristics',
    ],
  },
  { id: 'gender', sectionIds: [], showRules: true },
];

const STORAGE_KEY = 'schleifer.rulesTab';

@Component({
  selector: 'app-rules',
  standalone: true,
  template: `
    <main class="page page--narrow">
      <span class="eyebrow">{{ i18n.t('eyebrow.rulesRef') }}</span>
      <h1>{{ i18n.t('rules.title') }}</h1>
      <p class="muted">{{ i18n.t('rules.lead') }}</p>

      <div role="tablist" class="tabs" [attr.aria-label]="i18n.t('rules.title')">
        @for (t of tabs; track t.id; let i = $index) {
          <button
            #tabBtn
            role="tab"
            type="button"
            [id]="'tab-' + t.id"
            [attr.aria-selected]="activeTab === t.id"
            [attr.aria-controls]="'panel-' + t.id"
            [attr.tabindex]="activeTab === t.id ? 0 : -1"
            [class.is-active]="activeTab === t.id"
            (click)="setTab(t.id)"
            (keydown)="onTabKey($event, i)"
          >
            {{ i18n.t('tabs.' + t.id) }}
          </button>
        }
      </div>

      @for (t of tabs; track t.id) {
        @if (activeTab === t.id) {
          <section
            role="tabpanel"
            [id]="'panel-' + t.id"
            [attr.aria-labelledby]="'tab-' + t.id"
            class="tabpanel"
          >
            @if (t.showRules) {
              @for (r of rules; track r.id) {
                <article class="rule-card">
                  <h4>
                    <span class="rid">{{ i18n.t('rules.rule', { n: r.id }) }}</span>
                    {{ i18n.ruleTitle(r.id, r.title) }}
                  </h4>
                  @if (r.expectedGender) {
                    <p class="small" style="margin: 6px 0;">
                      <strong>{{ i18n.t('rules.expectedGender') }}</strong>
                      {{ i18n.gender(r.expectedGender) }}
                    </p>
                  }
                  @if (r.feedbackMessage) {
                    <p>{{ i18n.ruleFeedback(r.id, r.feedbackMessage) }}</p>
                  }
                  @if (catalogMatches(r.id).length > 0) {
                    <details class="examples">
                      <summary>
                        {{ i18n.t('rules.fromCatalog', { n: catalogMatches(r.id).length }) }}
                      </summary>
                      <ul>
                        @for (n of catalogMatches(r.id).slice(0, 30); track n.id) {
                          <li>
                            <strong>{{ articleFor(n) }} {{ n.singular }}</strong>
                            @if (n.english) { <span class="muted"> — {{ n.english }}</span> }
                          </li>
                        }
                      </ul>
                      @if (catalogMatches(r.id).length > 30) {
                        <p class="muted small">{{ i18n.t('rules.andMore', { n: catalogMatches(r.id).length - 30 }) }}</p>
                      }
                    </details>
                  }
                </article>
              }
            } @else {
              @for (sectionId of t.sectionIds; track sectionId) {
                @if (sectionById.get(sectionId); as s) {
                  <section class="case-section">
                    <h2>{{ s.title }}</h2>
                    <div class="case-tables__body" [innerHTML]="s.htmlSafe"></div>
                  </section>
                }
              }
            }
          </section>
        }
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        margin: 24px 0 0;
        border-bottom: 1px solid var(--rule);
      }
      .tabs button {
        background: transparent;
        border: 0;
        font: 700 11px/1 var(--font-mono);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-2);
        padding: 14px 18px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition:
          color var(--dur-fast) var(--ease-standard),
          border-color var(--dur-fast) var(--ease-standard);
        white-space: nowrap;
      }
      .tabs button:hover {
        color: var(--ink);
        background: transparent;
      }
      .tabs button.is-active {
        color: var(--orange);
        border-bottom-color: var(--orange);
        background: transparent;
      }
      .tabs button:focus-visible {
        outline: 2px solid var(--orange);
        outline-offset: -2px;
        border-radius: 0;
      }
      .tabpanel { padding-top: 32px; }
      .case-section {
        background: transparent;
        border: 0;
        border-top: 1px solid var(--rule);
        border-radius: 0;
        padding: 22px 0 4px;
        margin-bottom: 0;
      }
      .case-section:last-child { border-bottom: 1px solid var(--rule); }
      .case-section h2 {
        font-family: var(--font-sans);
        font-weight: 800;
        font-size: 22px;
        letter-spacing: -0.01em;
        margin: 0 0 12px;
        color: var(--ink);
      }
      .examples {
        margin-top: 12px;
        font-size: 13.5px;
        border-top: 1px solid var(--rule-2);
        padding-top: 10px;
      }
      .examples summary {
        cursor: pointer;
        color: var(--ink-2);
        font-family: var(--font-mono);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-weight: 700;
        list-style: none;
      }
      .examples summary::marker, .examples summary::-webkit-details-marker { display: none; }
      .examples summary::before {
        content: '▸ ';
        display: inline-block;
        transition: transform var(--dur-fast) var(--ease-standard);
      }
      .examples[open] summary::before { transform: rotate(90deg); }
      .examples summary:hover { color: var(--ink); }
      .examples ul {
        margin: 10px 0 0;
        padding-left: 18px;
        column-count: 2;
        column-gap: 24px;
      }
      .examples li { margin: 2px 0; break-inside: avoid; color: var(--ink-2); }
      .examples li strong { color: var(--ink); font-weight: 700; }
      @media (max-width: 600px) { .examples ul { column-count: 1; } }
    `,
  ],
})
export class RulesComponent implements OnInit {
  private catalog = inject(CatalogService);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  i18n = inject(I18nService);

  readonly tabs = TABS;
  rules: Rule[] = [];
  sectionById = new Map<string, CaseSection>();
  activeTab: TabId = this.loadTab();

  @ViewChildren('tabBtn') tabBtns?: QueryList<ElementRef<HTMLButtonElement>>;

  async ngOnInit() {
    await this.catalog.init();
    this.rules = this.catalog.allRules();

    try {
      const data = await firstValueFrom(
        this.http.get<{ sections: { id: string; title: string; html: string }[] }>(
          'assets/case-tables.json',
        ),
      );
      for (const s of data.sections) {
        this.sectionById.set(s.id, {
          id: s.id,
          title: s.title,
          htmlSafe: this.sanitizer.bypassSecurityTrustHtml(s.html),
        });
      }
    } catch {
      // leave sectionById empty; tabs will just render empty panels
    }
  }

  setTab(id: TabId) {
    this.activeTab = id;
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }

  onTabKey(ev: KeyboardEvent, idx: number) {
    let next = -1;
    if (ev.key === 'ArrowRight') next = (idx + 1) % this.tabs.length;
    else if (ev.key === 'ArrowLeft') next = (idx - 1 + this.tabs.length) % this.tabs.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = this.tabs.length - 1;
    else return;
    ev.preventDefault();
    this.setTab(this.tabs[next].id);
    setTimeout(() => this.tabBtns?.toArray()[next]?.nativeElement.focus(), 0);
  }

  catalogMatches(ruleId: number): Noun[] {
    return this.catalog.nounsForRule(ruleId);
  }

  articleFor(n: Noun): string {
    if (n.pluralOnly) return 'die';
    return n.gender === 'm' ? 'der' : n.gender === 'f' ? 'die' : 'das';
  }

  private loadTab(): TabId {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as TabId | null;
      if (stored && TABS.some((t) => t.id === stored)) return stored;
    } catch {}
    return 'cases';
  }
}
