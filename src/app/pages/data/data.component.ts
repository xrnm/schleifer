import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog.service';
import { DbService } from '../../core/db.service';
import { I18nService } from '../../core/i18n.service';
import { TransferService } from '../../core/transfer.service';

@Component({
  selector: 'app-data',
  standalone: true,
  imports: [],
  template: `
    <section class="page page--narrow">
      <span class="eyebrow">
        {{ i18n.t('eyebrow.corpus', { n: catalog.allNouns().length }) }}
      </span>
      <h1>{{ i18n.t('data.title') }}</h1>
      <p class="muted">{{ i18n.t('data.lead') }}</p>

      @if (counts) {
        <div class="stat-strip" style="grid-template-columns: repeat(5, 1fr); margin-top: 16px;">
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ counts['nouns'] }}</span>
            <div class="stat-strip__lbl">{{ nounsLabel }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ counts['cards'] }}</span>
            <div class="stat-strip__lbl">{{ cardsLabel }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ counts['cardStates'] }}</span>
            <div class="stat-strip__lbl">{{ cardStatesLabel }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ counts['sessions'] }}</span>
            <div class="stat-strip__lbl">{{ sessionsLabel }}</div>
          </div>
          <div class="stat-strip__cell">
            <span class="stat-strip__num">{{ counts['events'] }}</span>
            <div class="stat-strip__lbl">{{ eventsLabel }}</div>
          </div>
        </div>
      }

      <div class="cta-row" style="margin-top: 24px;">
        <button class="btn btn--primary" (click)="onExport()">{{ i18n.t('data.exportBtn') }}</button>
        <label class="btn btn--ghost" style="cursor: pointer;">
          <input type="file" accept="application/json" (change)="onImport($event)" hidden />
          <span>{{ i18n.t('data.importBtn') }}</span>
        </label>
        <button class="btn btn--quiet" style="color: var(--bad); border-color: var(--bad);" (click)="onWipe()">
          {{ i18n.t('data.wipeBtn') }}
        </button>
      </div>

      @if (status) {
        <p
          class="small"
          style="background: var(--bg-2); border-left: 3px solid var(--orange); padding: 10px 14px; margin-top: 16px; font-family: var(--font-mono); color: var(--ink);"
        >
          {{ status }}
        </p>
      }

    </section>
  `,
  styles: [],
})
export class DataComponent implements OnInit {
  private db = inject(DbService);
  private transfer = inject(TransferService);
  private router = inject(Router);
  catalog = inject(CatalogService);
  i18n = inject(I18nService);

  counts: Record<string, number> | null = null;
  status = '';

  // The localized labels are formatted "{n} <label>", so we extract the
  // suffix only by formatting with empty n and trimming.
  get nounsLabel(): string { return this.labelOnly('data.counts.nouns'); }
  get cardsLabel(): string { return this.labelOnly('data.counts.cards'); }
  get cardStatesLabel(): string { return this.labelOnly('data.counts.cardStates'); }
  get sessionsLabel(): string { return this.labelOnly('data.counts.sessions'); }
  get eventsLabel(): string { return this.labelOnly('data.counts.events'); }

  private labelOnly(key: string): string {
    return this.i18n.t(key, { n: '' }).trim();
  }

  async ngOnInit() { await this.refresh(); }

  private async refresh() {
    await this.catalog.init();
    this.counts = await this.db.counts();
  }

  async onExport() {
    const blob = await this.transfer.exportBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `schleifer-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.status = this.i18n.t('data.exportedMsg');
    await this.refresh();
  }

  async onImport(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const ok = window.confirm(this.i18n.t('data.importConfirm'));
    if (!ok) {
      input.value = '';
      return;
    }
    try {
      const text = await file.text();
      const result = await this.transfer.importJson(text);
      this.status = this.i18n.t('data.importedMsg', {
        a: result.cardStates,
        b: result.sessions,
        c: result.events,
      });
      await this.refresh();
    } catch (e: unknown) {
      this.status = this.i18n.t('data.importFailed', { msg: (e as Error).message });
    } finally {
      input.value = '';
    }
  }

  async onWipe() {
    const ok = window.confirm(this.i18n.t('data.wipeConfirm'));
    if (!ok) return;
    await this.db.clearUserData();
    this.status = this.i18n.t('data.wipedMsg');
    await this.refresh();
  }

  goHome() { this.router.navigate(['/']); }
}
