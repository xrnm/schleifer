import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../core/catalog.service';
import { I18nService } from '../../core/i18n.service';
import { Gender, Noun, UserNounInput } from '../../models/types';

function blankForm(): UserNounInput {
  return {
    singular: '',
    plural: '',
    pluralOnly: false,
    gender: 'm',
    english: '',
    importance: 5,
  };
}

@Component({
  selector: 'app-mine',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page page--narrow">
      <span class="eyebrow">{{ i18n.t('mine.eyebrow', { n: nouns.length }) }}</span>
      <h1>{{ i18n.t('mine.title') }}</h1>
      <p class="muted">{{ i18n.t('mine.lead') }}</p>

      @if (!showForm) {
        <div class="cta-row" style="margin-top: 20px;">
          <button class="btn btn--primary" (click)="startAdd()">
            {{ i18n.t('mine.addBtn') }}
          </button>
        </div>
      }

      @if (showForm) {
        <form class="noun-form" (ngSubmit)="save()">
          <h2 class="form-title">
            {{ editingId ? i18n.t('mine.form.editTitle') : i18n.t('mine.form.addTitle') }}
          </h2>

          <label class="field">
            <span class="field__k">
              {{ form.pluralOnly ? i18n.t('mine.form.singularPluralOnly') : i18n.t('mine.form.singular') }}
            </span>
            <input class="ti" type="text" name="singular" [(ngModel)]="form.singular" autocomplete="off" />
          </label>

          <div class="field">
            <span class="field__k">{{ i18n.t('mine.form.gender') }}</span>
            <div class="settings-pills" role="group" [attr.aria-label]="i18n.t('mine.form.gender')">
              @for (g of genders; track g.value) {
                <button
                  type="button"
                  class="pill"
                  [class.is-active]="form.gender === g.value"
                  (click)="form.gender = g.value"
                >{{ g.label }}</button>
              }
            </div>
          </div>

          @if (!form.pluralOnly) {
            <label class="field">
              <span class="field__k">{{ i18n.t('mine.form.plural') }}</span>
              <input class="ti" type="text" name="plural" [(ngModel)]="form.plural" autocomplete="off" />
            </label>
          }

          <label class="field field--check">
            <input type="checkbox" name="pluralOnly" [(ngModel)]="form.pluralOnly" />
            <span>{{ i18n.t('mine.form.pluralOnly') }}</span>
          </label>

          <label class="field">
            <span class="field__k">{{ i18n.t('mine.form.english') }}</span>
            <input class="ti" type="text" name="english" [(ngModel)]="form.english" autocomplete="off" />
          </label>

          <label class="field">
            <span class="field__k">{{ i18n.t('mine.form.importance') }} · {{ form.importance }}</span>
            <input type="range" name="importance" min="1" max="10" [(ngModel)]="form.importance" />
          </label>

          @if (error) {
            <p class="form-err">{{ error }}</p>
          }

          <div class="cta-row" style="margin-top: 8px;">
            <button type="submit" class="btn btn--primary">{{ i18n.t('mine.form.save') }}</button>
            <button type="button" class="btn btn--ghost" (click)="cancel()">
              {{ i18n.t('mine.form.cancel') }}
            </button>
          </div>
        </form>
      }

      @if (status) {
        <p
          class="small"
          style="background: var(--bg-2); border-left: 3px solid var(--orange); padding: 10px 14px; margin-top: 16px; font-family: var(--font-mono); color: var(--ink);"
        >
          {{ status }}
        </p>
      }

      <ul class="noun-list">
        @for (n of nouns; track n.id) {
          <li class="noun-row">
            <div class="noun-row__word">
              <span class="art art--{{ n.gender }}">{{ articleOf(n) }}</span>
              <span class="noun-row__sg">{{ n.pluralOnly ? n.singular : n.singular }}</span>
              @if (n.plural && !n.pluralOnly) {
                <span class="noun-row__pl">· {{ n.plural }}</span>
              }
              <span class="noun-row__en">{{ n.english }}</span>
            </div>
            <div class="noun-row__actions">
              <button class="btn btn--quiet btn--sm" (click)="startEdit(n)">
                {{ i18n.t('mine.editBtn') }}
              </button>
              <button
                class="btn btn--quiet btn--sm"
                style="color: var(--bad); border-color: var(--bad);"
                (click)="remove(n)"
              >{{ i18n.t('mine.deleteBtn') }}</button>
            </div>
          </li>
        } @empty {
          <li class="noun-empty">{{ i18n.t('mine.empty') }}</li>
        }
      </ul>

    </section>
  `,
  styles: [
    `
      .noun-form {
        margin-top: 20px;
        border: 1px solid var(--rule);
        background: var(--bg-2);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-title {
        font: 700 12px/1 var(--font-mono);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-2);
        margin: 0;
      }
      .field { display: flex; flex-direction: column; gap: 8px; }
      .field--check {
        flex-direction: row;
        align-items: center;
        gap: 10px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--ink);
        cursor: pointer;
      }
      .field__k {
        font: 700 11px/1 var(--font-mono);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-2);
      }
      .ti {
        width: 100%;
        padding: 12px 14px;
        font: 500 16px/1.3 var(--font-mono);
        color: var(--ink);
        background: var(--bg-3);
        border: 1px solid var(--rule);
        border-radius: 0;
        outline: none;
        caret-color: var(--orange);
      }
      .ti:focus { border-color: var(--ink); }
      input[type='range'] { accent-color: var(--orange); }
      .settings-pills {
        display: inline-flex;
        gap: 0;
        border: 1px solid var(--rule);
        background: var(--bg);
        width: fit-content;
      }
      .pill {
        background: transparent;
        border: 0;
        border-right: 1px solid var(--rule);
        padding: 8px 16px;
        font: 700 11px/1 var(--font-mono);
        letter-spacing: 0.1em;
        color: var(--ink-2);
        cursor: pointer;
        text-transform: uppercase;
      }
      .pill:last-child { border-right: 0; }
      .pill:hover { color: var(--ink); background: var(--bg-3); }
      .pill.is-active { color: var(--bg); background: var(--orange); }
      .form-err {
        color: var(--bad);
        font: 500 12px/1.4 var(--font-mono);
        margin: 0;
      }
      .noun-list { list-style: none; padding: 0; margin: 24px 0 0; }
      .noun-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid var(--rule);
      }
      .noun-row:last-child { border-bottom: 1px solid var(--rule); }
      .noun-row__word {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
        font-family: var(--font-mono);
      }
      .art { font-weight: 700; }
      .art--m { color: var(--der); }
      .art--f { color: var(--die); }
      .art--n { color: var(--das); }
      .noun-row__sg { color: var(--ink); font-weight: 500; }
      .noun-row__pl { color: var(--ink-3); }
      .noun-row__en { color: var(--ink-2); font-size: 13px; }
      .noun-row__actions { display: flex; gap: 8px; flex-shrink: 0; }
      .btn--sm { padding: 8px 12px; font-size: 10px; }
      .noun-empty {
        padding: 24px 0;
        color: var(--ink-3);
        font-family: var(--font-mono);
        font-size: 13px;
        border-top: 1px solid var(--rule);
      }
      @media (max-width: 640px) {
        .noun-row { flex-direction: column; align-items: flex-start; }
      }
    `,
  ],
})
export class MineComponent implements OnInit {
  catalog = inject(CatalogService);
  i18n = inject(I18nService);

  readonly genders: { value: Gender; label: string }[] = [
    { value: 'm', label: 'der' },
    { value: 'f', label: 'die' },
    { value: 'n', label: 'das' },
  ];

  showForm = false;
  editingId: string | null = null;
  form: UserNounInput = blankForm();
  status = '';
  error = '';

  get nouns(): Noun[] {
    // Reading the signal keeps this getter in sync after each mutation.
    this.catalog.changed();
    return this.catalog.userNouns();
  }

  async ngOnInit() {
    await this.catalog.init();
  }

  articleOf(n: Noun): string {
    return n.gender === 'm' ? 'der' : n.gender === 'f' ? 'die' : 'das';
  }

  startAdd() {
    this.editingId = null;
    this.form = blankForm();
    this.error = '';
    this.status = '';
    this.showForm = true;
  }

  startEdit(n: Noun) {
    this.editingId = n.id;
    this.form = {
      singular: n.singular,
      plural: n.plural ?? '',
      pluralOnly: n.pluralOnly,
      gender: n.gender,
      english: n.english,
      importance: n.importance,
    };
    this.error = '';
    this.status = '';
    this.showForm = true;
  }

  cancel() {
    this.showForm = false;
    this.editingId = null;
    this.error = '';
  }

  async save() {
    const singular = this.form.singular.trim();
    const english = this.form.english.trim();
    if (!singular || !english) {
      this.error = this.i18n.t('mine.validation.required');
      return;
    }
    // Soft duplicate warning: same word + gender already in the catalog.
    const dup = this.catalog
      .allNouns()
      .find(
        (n) =>
          n.id !== this.editingId &&
          n.gender === this.form.gender &&
          n.singular.trim().toLowerCase() === singular.toLowerCase(),
      );
    if (dup && !window.confirm(this.i18n.t('mine.dupWarning', { w: singular }))) {
      return;
    }

    const input: UserNounInput = {
      ...this.form,
      singular,
      english,
      importance: Math.min(10, Math.max(1, Number(this.form.importance) || 5)),
    };

    if (this.editingId) {
      await this.catalog.updateUserNoun(this.editingId, input);
      this.status = this.i18n.t('mine.savedMsg', { w: singular });
    } else {
      await this.catalog.addUserNoun(input);
      this.status = this.i18n.t('mine.savedMsg', { w: singular });
    }
    this.showForm = false;
    this.editingId = null;
  }

  async remove(n: Noun) {
    if (!window.confirm(this.i18n.t('mine.deleteConfirm', { w: n.singular }))) {
      return;
    }
    await this.catalog.deleteUserNoun(n.id);
    this.status = this.i18n.t('mine.deletedMsg', { w: n.singular });
  }
}
