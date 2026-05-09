import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { I18nService } from './core/i18n.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <div class="topbar__inner">
        <a routerLink="/" class="brand" aria-label="Schleifer home">
          <span class="bevel" aria-hidden="true"></span>
          {{ i18n.t('app.brand') }}
          <span class="brand__sub">{{ i18n.t('app.brandSub') }}</span>
        </a>
        <nav class="nav">
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">
            <span class="nav__label">{{ i18n.t('nav.home') }}</span>
          </a>
          <a routerLink="/rules" routerLinkActive="is-active">
            <span class="nav__label">{{ i18n.t('nav.rules') }}</span>
          </a>
          <a routerLink="/data" routerLinkActive="is-active">
            <span class="nav__label">{{ i18n.t('nav.data') }}</span>
          </a>

          <label class="lang-slider" [title]="i18n.lang() === 'de' ? 'Sprache' : 'Language'">
            <span class="lang-label" [class.active]="i18n.lang() === 'en'">EN</span>
            <input
              type="checkbox"
              [checked]="i18n.lang() === 'de'"
              (change)="onToggle($event)"
              [attr.aria-label]="i18n.lang() === 'de' ? 'Sprache umschalten' : 'Toggle language'"
            />
            <span class="track"><span class="thumb"></span></span>
            <span class="lang-label" [class.active]="i18n.lang() === 'de'">DE</span>
          </label>
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

      .lang-slider {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
        user-select: none;
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--ink-3);
        margin-left: 0.5rem;
        padding-left: 12px;
        border-left: 1px solid var(--rule);
      }
      @media (max-width: 640px) {
        .lang-slider {
          margin-left: 0.25rem;
          padding-left: 8px;
          gap: 0.3rem;
        }
        .footer__inner {
          padding: 14px 16px;
        }
        .footer__credit, .footer__link { font-size: 10px; letter-spacing: 0.12em; }
        .footer__sep { display: none; }
      }
      .lang-slider input { display: none; }
      .lang-label.active { color: var(--orange); }
      .lang-slider .track {
        position: relative;
        width: 28px;
        height: 14px;
        background: var(--bg-2);
        border: 1px solid var(--rule);
        border-radius: 0;
        transition: background var(--dur-fast) var(--ease-standard),
                    border-color var(--dur-fast) var(--ease-standard);
      }
      .lang-slider .thumb {
        position: absolute;
        top: 1px;
        left: 1px;
        width: 10px;
        height: 10px;
        background: var(--ink-2);
        border-radius: 0;
        transition: transform var(--dur-fast) var(--ease-standard),
                    background var(--dur-fast) var(--ease-standard);
      }
      .lang-slider input:checked ~ .track {
        background: var(--bg-2);
        border-color: var(--orange);
      }
      .lang-slider input:checked ~ .track .thumb {
        transform: translateX(14px);
        background: var(--orange);
      }
    `,
  ],
})
export class AppComponent {
  i18n = inject(I18nService);

  onToggle(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.i18n.setLang(checked ? 'de' : 'en');
  }
}
