import { Component, Input, inject } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { SpeechService } from '../core/speech.service';

/**
 * Small icon button that speaks a German string aloud. Renders nothing when
 * the browser has no speech synthesis. Uses a Feather-style `volume-2` icon
 * to match the app's other inline SVGs.
 */
@Component({
  selector: 'app-speak-button',
  standalone: true,
  template: `
    @if (speech.supported) {
      <button
        type="button"
        class="speak-btn"
        [class.speak-btn--lg]="size === 'lg'"
        (click)="onClick()"
        [attr.aria-label]="i18n.t('a11y.listen')"
        [attr.title]="i18n.t('a11y.listen')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      .speak-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: 0;
        padding: 5px;
        line-height: 0;
        transition: color var(--dur-fast) var(--ease-standard);
      }
      .speak-btn svg { width: 15px; height: 15px; }
      .speak-btn--lg { padding: 7px; }
      .speak-btn--lg svg { width: 20px; height: 20px; }
      .speak-btn:hover {
        color: var(--ink);
      }
      .speak-btn:focus-visible {
        outline: 2px solid var(--orange);
        outline-offset: 2px;
      }
    `,
  ],
})
export class SpeakButtonComponent {
  i18n = inject(I18nService);
  speech = inject(SpeechService);

  /** German text to speak. */
  @Input({ required: true }) text = '';
  /** `lg` is used for the large quiz prompt; default is the inline size. */
  @Input() size: 'sm' | 'lg' = 'sm';

  onClick() {
    // Slashes (e.g. "der Apfel / die Äpfel") become comma pauses so the
    // voice doesn't read the "/" aloud.
    this.speech.speak(this.text.replace(/\s*\/\s*/g, ', '));
  }
}
