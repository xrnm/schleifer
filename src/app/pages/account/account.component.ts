import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { SyncService } from '../../core/sync.service';
import { DataComponent } from '../data/data.component';
import { MineComponent } from '../mine/mine.component';

type Mode = 'signIn' | 'signUp' | 'reset' | 'recovery';
type Panel = 'account' | 'nouns' | 'data';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule, RouterLink, MineComponent, DataComponent],
  template: `
    <main class="page page--narrow">
      <!-- Section tabs: account/sync, custom nouns, and data all live here so
           the top nav stays lean. Nouns + data work signed-out too. -->
      <div class="acct-tabs" role="tablist">
        <button
          class="acct-tab"
          [class.is-active]="activePanel() === 'account'"
          (click)="panel.set('account')"
        >{{ i18n.t('nav.account') }}</button>
        <button
          class="acct-tab"
          [class.is-active]="activePanel() === 'nouns'"
          (click)="panel.set('nouns')"
        >{{ i18n.t('nav.mine') }}</button>
        <button
          class="acct-tab"
          [class.is-active]="activePanel() === 'data'"
          (click)="panel.set('data')"
        >{{ i18n.t('nav.data') }}</button>
      </div>

      @if (activePanel() === 'nouns') {
        <app-mine />
      } @else if (activePanel() === 'data') {
        <app-data />
      } @else {
      <span class="eyebrow">{{ i18n.t('account.eyebrow') }}</span>

      @if (auth.status() === 'signedIn' && !auth.recovery()) {
        <!-- Signed-in dashboard -->
        <h1>{{ i18n.t('account.signedInTitle') }}</h1>
        <p class="muted">{{ i18n.t('account.signedInAs', { email: auth.email() || '' }) }}</p>

        <div class="sync-box">
          <div class="sync-box__row">
            <span class="sync-box__k">{{ i18n.t('account.syncStatus') }}</span>
            <span class="sync-box__v" [class.is-err]="sync.status() === 'error'">
              {{ syncLabel() }}
            </span>
          </div>
          @if (sync.lastSyncedAt()) {
            <div class="sync-box__row">
              <span class="sync-box__k">{{ i18n.t('account.lastSynced') }}</span>
              <span class="sync-box__v">{{ i18n.relTime(sync.lastSyncedAt()) }}</span>
            </div>
          }
        </div>

        <div class="cta-row" style="margin-top: 20px;">
          <button class="btn btn--primary" [disabled]="sync.status() === 'syncing'" (click)="syncNow()">
            {{ sync.status() === 'syncing' ? i18n.t('account.syncing') : i18n.t('account.syncNow') }}
          </button>
          <button class="btn btn--ghost" (click)="signOut()">{{ i18n.t('account.signOut') }}</button>
        </div>
      } @else if (mode() === 'recovery') {
        <!-- New-password form after a reset-email landing -->
        <h1>{{ i18n.t('account.recoveryTitle') }}</h1>
        <p class="muted">{{ i18n.t('account.recoveryLead') }}</p>
        <form class="auth-form" (ngSubmit)="doUpdatePassword()">
          <label class="field">
            <span class="field__k">{{ i18n.t('account.newPassword') }}</span>
            <input class="ti" type="password" name="np" [(ngModel)]="password" autocomplete="new-password" />
          </label>
          <button type="submit" class="btn btn--primary" [disabled]="busy()">
            {{ i18n.t('account.updatePassword') }}
          </button>
        </form>
      } @else {
        <!-- Signed-out: sign in / sign up / reset -->
        <h1>{{ titleForMode() }}</h1>
        <p class="muted">{{ i18n.t('account.freeNote') }}</p>

        <form class="auth-form" (ngSubmit)="submit()">
          <label class="field">
            <span class="field__k">{{ i18n.t('account.email') }}</span>
            <input class="ti" type="email" name="email" [(ngModel)]="email" autocomplete="email" />
          </label>
          @if (mode() !== 'reset') {
            <label class="field">
              <span class="field__k">{{ i18n.t('account.password') }}</span>
              <input
                class="ti"
                type="password"
                name="password"
                [(ngModel)]="password"
                [attr.autocomplete]="mode() === 'signUp' ? 'new-password' : 'current-password'"
              />
            </label>
          }
          <button type="submit" class="btn btn--primary" [disabled]="busy()">
            {{ submitLabel() }}
          </button>
        </form>

        <div class="auth-switch">
          @if (mode() === 'signIn') {
            <button class="linkish" (click)="setMode('signUp')">{{ i18n.t('account.toSignUp') }}</button>
            <button class="linkish" (click)="setMode('reset')">{{ i18n.t('account.toReset') }}</button>
          } @else {
            <button class="linkish" (click)="setMode('signIn')">{{ i18n.t('account.toSignIn') }}</button>
          }
        </div>
      }

      @if (message()) {
        <p
          class="small"
          [style.borderLeftColor]="isError() ? 'var(--bad)' : 'var(--orange)'"
          style="background: var(--bg-2); border-left: 3px solid var(--orange); padding: 10px 14px; margin-top: 16px; font-family: var(--font-mono); color: var(--ink);"
        >
          {{ message() }}
        </p>
      }

      <p style="margin-top: 24px;">
        <a routerLink="/deklination" style="cursor:pointer;">{{ i18n.t('account.backLink') }}</a>
      </p>
      }
    </main>
  `,
  styles: [
    `
      .acct-tabs {
        display: inline-flex;
        border: 1px solid var(--rule);
        background: var(--bg);
        margin-bottom: 28px;
      }
      .acct-tab {
        background: transparent;
        border: 0;
        border-right: 1px solid var(--rule);
        padding: 9px 18px;
        font: 700 11px/1 var(--font-mono);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-2);
        cursor: pointer;
        transition:
          color var(--dur-fast) var(--ease-standard),
          background var(--dur-fast) var(--ease-standard);
      }
      .acct-tab:last-child { border-right: 0; }
      .acct-tab:hover { color: var(--ink); background: var(--bg-3); }
      .acct-tab.is-active { color: var(--bg); background: var(--orange); }
      @media (max-width: 640px) {
        .acct-tabs { display: flex; width: 100%; }
        .acct-tab { flex: 1 1 auto; padding: 10px 8px; }
      }
      .auth-form {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 420px;
      }
      .field { display: flex; flex-direction: column; gap: 8px; }
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
      .auth-switch { display: flex; gap: 18px; margin-top: 18px; flex-wrap: wrap; }
      .linkish {
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        color: var(--orange);
        font: 700 11px/1 var(--font-mono);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .linkish:hover { color: var(--orange-2); text-decoration: underline; }
      .sync-box {
        margin-top: 20px;
        border: 1px solid var(--rule);
        background: var(--bg-2);
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 420px;
      }
      .sync-box__row { display: flex; justify-content: space-between; gap: 12px; }
      .sync-box__k {
        font: 700 11px/1 var(--font-mono);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-2);
      }
      .sync-box__v { font: 500 13px/1 var(--font-mono); color: var(--ink); }
      .sync-box__v.is-err { color: var(--bad); }
    `,
  ],
})
export class AccountComponent {
  auth = inject(AuthService);
  sync = inject(SyncService);
  i18n = inject(I18nService);

  email = '';
  password = '';
  private _mode = signal<Mode>('signIn');
  message = signal('');
  isError = signal(false);
  busy = signal(false);

  readonly panel = signal<Panel>('account');
  // A password-reset landing must force the account panel (recovery form).
  readonly activePanel = computed<Panel>(() =>
    this.auth.recovery() ? 'account' : this.panel(),
  );

  mode = computed<Mode>(() => (this.auth.recovery() ? 'recovery' : this._mode()));

  constructor() {
    // Clear transient messages when the user flips between forms.
    effect(() => {
      this._mode();
      this.auth.recovery();
    });
  }

  setMode(m: Mode) {
    this._mode.set(m);
    this.message.set('');
    this.isError.set(false);
    // Don't carry a typed password across a mode switch (hygiene, and avoids a
    // stale value lingering after sign-up).
    this.password = '';
  }

  titleForMode(): string {
    return this.mode() === 'signUp'
      ? this.i18n.t('account.signUpTitle')
      : this.mode() === 'reset'
        ? this.i18n.t('account.resetTitle')
        : this.i18n.t('account.signInTitle');
  }

  submitLabel(): string {
    return this.mode() === 'signUp'
      ? this.i18n.t('account.createAccount')
      : this.mode() === 'reset'
        ? this.i18n.t('account.sendReset')
        : this.i18n.t('account.signIn');
  }

  syncLabel(): string {
    return this.i18n.t('account.sync.' + this.sync.status());
  }

  private ok(key: string) {
    this.message.set(this.i18n.t(key));
    this.isError.set(false);
  }
  private fail(msg: string) {
    this.message.set(msg);
    this.isError.set(true);
  }

  async submit() {
    const email = this.email.trim();
    if (!email || (this.mode() !== 'reset' && !this.password)) {
      this.fail(this.i18n.t('account.validation.required'));
      return;
    }
    this.busy.set(true);
    try {
      if (this.mode() === 'signUp') {
        const { error } = await this.auth.signUp(email, this.password);
        if (error) return this.fail(error.message);
        this.password = '';
        this.ok('account.checkEmail');
      } else if (this.mode() === 'reset') {
        const { error } = await this.auth.resetPassword(email);
        if (error) return this.fail(error.message);
        this.ok('account.resetSent');
      } else {
        const { error } = await this.auth.signIn(email, this.password);
        if (error) return this.fail(error.message);
        this.password = '';
      }
    } finally {
      this.busy.set(false);
    }
  }

  async doUpdatePassword() {
    if (!this.password) {
      this.fail(this.i18n.t('account.validation.required'));
      return;
    }
    this.busy.set(true);
    try {
      const { error } = await this.auth.updatePassword(this.password);
      if (error) return this.fail(error.message);
      this.password = '';
      this.ok('account.passwordUpdated');
    } finally {
      this.busy.set(false);
    }
  }

  async syncNow() {
    try {
      await this.sync.syncNow();
    } catch (e) {
      this.fail((e as Error).message);
    }
  }

  async signOut() {
    // Flush any pending local changes to the cloud while we still hold a
    // session — otherwise unsynced work could be dropped if a different account
    // signs in next on a shared device.
    this.busy.set(true);
    try {
      await this.sync.syncNow();
    } catch {
      /* best-effort; local data stays on the device regardless */
    }
    await this.auth.signOut();
    this.busy.set(false);
    this.ok('account.signedOut');
  }
}
