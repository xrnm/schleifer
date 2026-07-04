import { Injectable } from '@angular/core';

/**
 * Thin wrapper around the Web Speech API for speaking German words aloud.
 * German is always spoken with the `de-DE` voice, independent of the UI
 * language. Degrades to a no-op when the browser has no speech synthesis.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  private synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;

  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (!this.synth) return;
    this.refreshVoices();
    // Voices load asynchronously in most browsers; re-read when they arrive.
    this.synth.addEventListener?.('voiceschanged', () => this.refreshVoices());
  }

  /** Whether the browser can speak at all. */
  get supported(): boolean {
    return this.synth !== null;
  }

  private refreshVoices() {
    this.voices = this.synth?.getVoices() ?? [];
  }

  private pickVoice(locale: string): SpeechSynthesisVoice | undefined {
    const lc = locale.toLowerCase();
    const lang = lc.split('-')[0];
    // Prefer an exact locale match, then any voice for the base language.
    return (
      this.voices.find((v) => v.lang?.toLowerCase() === lc) ??
      this.voices.find((v) => v.lang?.toLowerCase().startsWith(lang))
    );
  }

  /**
   * Speak `text` in `locale` (default German). Cancels any in-flight
   * utterance first so rapid taps don't queue up.
   */
  speak(text: string, locale = 'de-DE') {
    if (!this.synth || !text.trim()) return;
    this.synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = locale;
    const voice = this.pickVoice(locale);
    if (voice) utter.voice = voice;
    this.synth.speak(utter);
  }
}
