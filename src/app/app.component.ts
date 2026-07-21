import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { I18nService, LANGS, Lang } from './core/i18n.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <div class="topbar__inner">
        <a routerLink="/deklination" class="brand" aria-label="Schleifer home">
          <span class="bevel" aria-hidden="true"></span>
          {{ i18n.t('app.brand') }}
          <span class="brand__sub">{{ i18n.t('app.brandSub') }}</span>
        </a>
        <nav class="nav">
          <a routerLink="/deklination" routerLinkActive="is-active">
            <span class="nav__label">{{ i18n.t('nav.deklination') }}</span>
          </a>
          <a routerLink="/vokabular" routerLinkActive="is-active">
            <span class="nav__label">{{ i18n.t('nav.vokabular') }}</span>
          </a>
          <a routerLink="/rules" routerLinkActive="is-active">
            <span class="nav__label">{{ i18n.t('nav.rules') }}</span>
          </a>
          <a
            routerLink="/account"
            routerLinkActive="is-active"
            class="nav__account"
            [class.is-signed-in]="auth.status() === 'signedIn'"
          >
            <svg
              class="nav__usericon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="square"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="3.4" />
              <path d="M5.5 19.2c0-3.5 2.9-5.8 6.5-5.8s6.5 2.3 6.5 5.8" />
            </svg>
            <span class="nav__label">{{
              auth.status() === 'signedIn' ? i18n.t('nav.account') : i18n.t('nav.signIn')
            }}</span>
          </a>

          <div class="lang-picker" role="group" [attr.aria-label]="langAriaLabel">
            @for (l of langs; track l) {
              <button
                type="button"
                class="lang-pill"
                [class.is-active]="i18n.lang() === l"
                [attr.aria-pressed]="i18n.lang() === l"
                (click)="setLang(l)"
              >{{ langCode(l) }}</button>
            }
          </div>
        </nav>
      </div>
    </header>
    <router-outlet />
    <footer class="footer">
      <div class="footer__inner">
        <span class="footer__credit">
          MADE WITH LOVE BY
          <a
            class="footer__link"
            href="https://justinedwards.me"
            target="_blank"
            rel="noopener noreferrer"
          >JUSTIN EDWARDS</a>
          <span class="footer__sep" aria-hidden="true">·</span>
          PAIRED WITH
          <a
            class="footer__link"
            href="https://claude.com/claude-code"
            target="_blank"
            rel="noopener noreferrer"
          >CLAUDE</a>
        </span>
        <a
          class="footer__link"
          href="https://github.com/xrnm/schleifer"
          target="_blank"
          rel="noopener noreferrer"
        >
          // SOURCE — github.com/xrnm/schleifer
        </a>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      router-outlet { display: contents; }
      :host > * { flex: 0 0 auto; }
      :host > router-outlet ~ * { /* allow main pages to fill before footer */ }

      .footer {
        margin-top: auto;
        border-top: 1px solid var(--rule);
        background: var(--bg);
        position: relative;
        z-index: 1;
      }
      .footer__inner {
        max-width: 1180px;
        margin: 0 auto;
        padding: 18px 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .footer__credit {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .footer__link {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-3);
        text-decoration: none;
        transition: color var(--dur-fast) var(--ease-standard);
      }
      .footer__credit .footer__link { color: var(--ink-2); }
      .footer__sep { margin: 0 6px; color: var(--rule); }
      .footer__link:hover {
        color: var(--orange);
        text-decoration: none;
      }

      nav.nav a {
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 8px 12px;
        color: var(--ink-2);
        text-decoration: none;
        font: 700 11px/1 var(--font-mono);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        border-radius: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: color var(--dur-fast) var(--ease-standard);
      }
      nav.nav a:hover {
        color: var(--ink);
        background: transparent;
        text-decoration: none;
      }
      nav.nav a.is-active {
        color: var(--orange);
        background: transparent;
      }
      nav.nav a.is-active .nav__label::before { content: '[ '; }
      nav.nav a.is-active .nav__label::after  { content: ' ]'; }

      .nav__account { display: inline-flex; align-items: center; gap: 6px; }
      .nav__usericon {
        flex: 0 0 auto;
        display: block;
        color: var(--ink-3);
        transition: color var(--dur-fast) var(--ease-standard);
      }
      .nav__account:hover .nav__usericon { color: var(--ink); }
      .nav__account.is-active .nav__usericon { color: var(--orange); }
      /* Signed-in: the glyph carries the accent so state reads at a glance. */
      .nav__account.is-signed-in .nav__usericon { color: var(--das); }
      .nav__account.is-signed-in.is-active .nav__usericon { color: var(--orange); }

      .lang-picker {
        display: inline-flex;
        align-items: stretch;
        margin-left: 0.5rem;
        padding-left: 12px;
        border-left: 1px solid var(--rule);
        gap: 0;
      }
      .lang-pill {
        background: transparent;
        border: 1px solid var(--rule);
        border-right-width: 0;
        padding: 4px 8px;
        font: 700 10px/1 var(--font-mono);
        letter-spacing: 0.16em;
        color: var(--ink-3);
        text-transform: uppercase;
        cursor: pointer;
        transition:
          color var(--dur-fast) var(--ease-standard),
          background var(--dur-fast) var(--ease-standard),
          border-color var(--dur-fast) var(--ease-standard);
      }
      .lang-pill:last-child { border-right-width: 1px; }
      .lang-pill:hover { color: var(--ink); background: var(--bg-2); }
      .lang-pill.is-active {
        color: var(--bg);
        background: var(--orange);
        border-color: var(--orange);
      }
      .lang-pill:focus-visible {
        outline: 2px solid var(--orange);
        outline-offset: 2px;
        position: relative;
        z-index: 1;
      }
      @media (max-width: 640px) {
        .lang-picker {
          margin-left: 0.25rem;
          padding-left: 8px;
        }
        .lang-pill { padding: 4px 6px; font-size: 9px; }
        .footer__inner {
          padding: 14px 16px;
        }
        .footer__credit, .footer__link { font-size: 10px; letter-spacing: 0.12em; }
        .footer__sep { display: none; }
      }
    `,
  ],
})
export class AppComponent {
  i18n = inject(I18nService);
  auth = inject(AuthService);
  readonly langs: Lang[] = LANGS;

  get langAriaLabel(): string {
    switch (this.i18n.lang()) {
      case 'de': return 'Sprache umschalten';
      case 'es': return 'Cambiar idioma';
      default: return 'Toggle language';
    }
  }

  langCode(l: Lang): string { return l.toUpperCase(); }

  setLang(l: Lang) {
    this.i18n.setLang(l);
  }
}
