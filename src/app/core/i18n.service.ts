import { Injectable, signal } from '@angular/core';

export type Lang = 'en' | 'de';

const STORAGE_KEY = 'schleifer.lang';

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    'app.brand': 'Schleifer',
    'nav.home': 'Home',
    'nav.deklination': 'Declension',
    'nav.vokabular': 'Vocabulary',
    'nav.progress': 'Progress',
    'nav.rules': 'Rules',
    'nav.data': 'Data',

    'progress.eyebrow': 'PROGRESS · TIMELINE',
    'progress.title': 'Your timeline',
    'progress.lead':
      'Every card you\'ve reviewed, when it last appeared, and when it\'s scheduled back. View only — selection still drives itself.',
    'progress.empty': 'Nothing here yet. Start a session to fill this view.',
    'progress.stats.reviewed': 'reviewed',
    'progress.stats.learning': 'learning',
    'progress.stats.mastered': 'mastered',
    'progress.stats.dueNow': 'due now',
    'progress.group.dueNow': 'Due now',
    'progress.group.thisWeek': 'This week',
    'progress.group.later': 'Later',
    'progress.lastSeen': 'last',
    'progress.nextDue': 'due',
    'progress.now': 'now',
    'progress.streak': 'streak',
    'progress.lapses': 'misses',
    'progress.drillDueNow': 'Drill these ({n})',

    'app.brandSub': 'Deutsch · Kasus',
    'eyebrow.dailyDrill': 'SCHLEIFER · DAILY DRILL',
    'eyebrow.sessionComplete': 'SESSION COMPLETE',
    'eyebrow.rulesRef': 'REFERENCE · GENDER RULES',
    'eyebrow.corpus': 'CORPUS · {n} NOUNS',

    'home.h1': 'Grind your German cases.',
    'home.sub': 'Type the article and the noun for the case shown. {n} nouns in the corpus, weighted by importance. Misses come back until you get them right.',
    'home.kbdHint': 'Enter to submit · Esc to skip',
    'home.lead': 'Drill German noun cases. {n} nouns loaded.',
    'home.start': 'Start session ({n} cards)',
    'home.starting': 'Starting…',
    'home.dataExport': 'Data / Export',
    'home.stats.sessions': '{n} sessions',
    'home.stats.cardsReviewed': '{n} cards reviewed',
    'home.stats.dueNow': '{n} due now',
    'home.label.sessions': 'sessions',
    'home.label.cardsReviewed': 'cards reviewed',
    'home.label.dueNow': 'due now',
    'home.inProgress': 'In progress',
    'home.inProgressEmpty': 'Nothing in progress yet — start a session.',
    'home.recentlyMissed': 'Recently missed',
    'home.recentlyMissedEmpty': 'Nothing missed in the last 7 days.',
    'home.missedCount': '{n}× missed',
    'home.sessions': 'Sessions',
    'home.noSessions': 'No sessions yet.',
    'home.statusCompleted': 'completed',
    'home.statusInProgress': 'in progress',
    'home.andMore': '…and {n} more',
    'home.today': 'Today',
    'home.yesterday': 'Yesterday',
    'home.viewTimeline': 'View timeline →',
    'home.drillDueNow': 'Drill due now ({n})',
    'home.settings': 'Settings',
    'home.settings.toggleAria': 'Toggle settings',
    'settings.case': 'Case',
    'settings.number': 'Number',
    'settings.article': 'Article',
    'settings.case.all': 'All',
    'settings.case.nom': 'Nom',
    'settings.case.acc': 'Acc',
    'settings.case.dat': 'Dat',
    'settings.number.both': 'Both',
    'settings.number.sg': 'Sg',
    'settings.number.pl': 'Pl',
    'settings.article.both': 'Both',
    'settings.article.def': 'Definite',
    'settings.article.indef': 'Indefinite',

    'vokabular.eyebrow': 'SCHLEIFER · VOCABULARY',
    'vokabular.h1': 'Translate, pick the match.',
    'vokabular.sub': 'Multiple-choice translation drills. Direction shuffles each question. {n} nouns in the corpus.',
    'vokabular.start': 'Start session ({n} cards)',
    'vokabular.starting': 'Starting…',
    'vokabular.drillDueNow': 'Drill due now ({n})',

    'session.endSession': 'End session',
    'session.placeholder': 'Type the article + noun…',
    'session.submit': 'Submit',
    'session.skip': 'Skip',
    'session.idk': "I don't know",
    'session.next': 'Next',
    'session.result.correct': 'Correct',
    'session.result.typo': 'Almost — typo, accepted',
    'session.result.idk': 'Marked unknown',
    'session.result.incorrect': 'Incorrect',
    'session.result.articleMismatch': 'Right form — wrong article',
    'session.articleMismatch.usedDef': 'You answered with the definite article (der/die/das…). This card asked for the indefinite (ein…).',
    'session.articleMismatch.usedIndef': 'You answered with the indefinite article (ein…). This card asked for the definite (der/die/das…).',
    'session.youWrote': 'You wrote',
    'session.answer': 'Answer:',
    'session.nominativ': 'Nominativ:',
    'session.translation': 'Translation:',
    'session.rule': 'Rule {n}:',
    'session.notFound': 'Session not found.',
    'session.loading': 'Loading…',
    'session.summaryTitle': 'Session complete',
    'session.summaryH1': 'Nice work.',
    'session.kbdSubmit': 'submit',
    'session.kbdSkip': 'skip',
    'session.stats.correct': '{n} correct',
    'session.stats.wrong': '{n} wrong',
    'session.stats.unknown': '{n} unknown',
    'session.stats.skipped': '{n} skipped',
    'session.correctHeading': 'Correct ({n})',
    'session.missedHeading': 'Missed ({n})',
    'session.didntKnow': "didn't know — answer: {x}",
    'session.wroteVsExpected': 'wrote {x} · expected {y}',
    'session.typoLabel': 'typo: {x}',
    'session.backToHome': 'Back to home',

    'vokabular.prompt.de': 'What does this mean?',
    'vokabular.prompt.en': 'Which German noun fits?',
    'vokabular.answerLabel': 'Answer',
    'vokabular.result.correct': 'Correct',
    'vokabular.result.incorrect': 'Incorrect',
    'vokabular.summaryH1': 'Nice work.',

    'data.title': 'Data',
    'data.lead':
      'All your progress lives in this browser. Export to a file to back it up or move it.',
    'data.counts.nouns': '{n} nouns in catalog',
    'data.counts.cards': '{n} cards generated',
    'data.counts.cardStates': '{n} cards reviewed',
    'data.counts.sessions': '{n} sessions',
    'data.counts.events': '{n} activity events',
    'data.exportBtn': 'Export JSON',
    'data.importBtn': 'Import JSON…',
    'data.wipeBtn': 'Wipe progress',
    'data.exportedMsg': 'Exported.',
    'data.importedMsg':
      'Imported: {a} card states, {b} sessions, {c} events.',
    'data.importFailed': 'Import failed: {msg}',
    'data.importConfirm':
      'Importing will REPLACE all current progress (card states, sessions, events). Continue?',
    'data.wipeConfirm':
      'Permanently delete all progress, sessions, and activity events? The noun catalog stays.',
    'data.wipedMsg': 'Progress wiped.',
    'data.backLink': '← Back to home',

    'rules.title': 'Gender rules',
    'rules.lead':
      'Common patterns for predicting the gender of a German noun. These are heuristics, not absolute laws — exceptions exist.',
    'rules.rule': 'Rule {n}',
    'rules.expectedGender': 'Expected gender:',
    'rules.fromCatalog': 'From the catalog ({n})',
    'rules.andMore': '…and {n} more',
    'rules.tablesHeading': 'Articles & case tables',
    'rules.genderHeading': 'Gender heuristics',
    'rules.moreTables': 'More tables & references',
    'rules.genderHeuristics': 'Gender heuristics ({n})',
    'tabs.cases': 'Cases',
    'tabs.articles': 'Articles',
    'tabs.adjectives': 'Adjectives',
    'tabs.plurals': 'Plurals',
    'tabs.gender': 'Gender rules',

    'gender.feminine': 'feminine',
    'gender.masculine': 'masculine',
    'gender.neuter': 'neuter',
    'gender.varies': 'varies',
  },
  de: {
    'app.brand': 'Schleifer',
    'nav.home': 'Start',
    'nav.deklination': 'Deklination',
    'nav.vokabular': 'Vokabular',
    'nav.progress': 'Fortschritt',
    'nav.rules': 'Regeln',
    'nav.data': 'Daten',

    'progress.eyebrow': 'FORTSCHRITT · ZEITLEISTE',
    'progress.title': 'Deine Übersicht',
    'progress.lead':
      'Alle Karten, die du gelernt hast — wann sie zuletzt dran waren und wann sie wiederkommen. Nur zur Ansicht — die Auswahl steuert sich selbst.',
    'progress.empty': 'Noch nichts. Starte eine Sitzung, um diese Ansicht zu füllen.',
    'progress.stats.reviewed': 'gelernt',
    'progress.stats.learning': 'in Arbeit',
    'progress.stats.mastered': 'gefestigt',
    'progress.stats.dueNow': 'jetzt fällig',
    'progress.group.dueNow': 'Jetzt fällig',
    'progress.group.thisWeek': 'Diese Woche',
    'progress.group.later': 'Später',
    'progress.lastSeen': 'zuletzt',
    'progress.nextDue': 'fällig',
    'progress.now': 'jetzt',
    'progress.streak': 'Serie',
    'progress.lapses': 'Fehler',
    'progress.drillDueNow': 'Diese drillen ({n})',

    'app.brandSub': 'Deutsch · Kasus',
    'eyebrow.dailyDrill': 'SCHLEIFER · TÄGLICHES DRILLEN',
    'eyebrow.sessionComplete': 'SITZUNG ABGESCHLOSSEN',
    'eyebrow.rulesRef': 'REFERENZ · GENUSREGELN',
    'eyebrow.corpus': 'KORPUS · {n} NOMEN',

    'home.h1': 'Schleif deine deutschen Fälle.',
    'home.sub': 'Tippe den Artikel und das Nomen für den angezeigten Fall. {n} Nomen im Korpus, gewichtet nach Wichtigkeit. Verfehlte Karten kommen wieder, bis du sie kannst.',
    'home.kbdHint': 'Enter zum Absenden · Esc zum Überspringen',
    'home.lead': 'Übe deutsche Nomenfälle. {n} Nomen geladen.',
    'home.start': 'Sitzung starten ({n} Karten)',
    'home.starting': 'Beginnt…',
    'home.dataExport': 'Daten / Export',
    'home.stats.sessions': '{n} Sitzungen',
    'home.stats.cardsReviewed': '{n} Karten gelernt',
    'home.stats.dueNow': '{n} jetzt fällig',
    'home.label.sessions': 'Sitzungen',
    'home.label.cardsReviewed': 'Karten gelernt',
    'home.label.dueNow': 'jetzt fällig',
    'home.inProgress': 'In Bearbeitung',
    'home.inProgressEmpty': 'Noch nichts in Bearbeitung — starte eine Sitzung.',
    'home.recentlyMissed': 'Kürzlich verfehlt',
    'home.recentlyMissedEmpty': 'In den letzten 7 Tagen nichts verfehlt.',
    'home.missedCount': '{n}× verfehlt',
    'home.sessions': 'Sitzungen',
    'home.noSessions': 'Noch keine Sitzungen.',
    'home.statusCompleted': 'abgeschlossen',
    'home.statusInProgress': 'in Bearbeitung',
    'home.andMore': '…und {n} weitere',
    'home.today': 'Heute',
    'home.yesterday': 'Gestern',
    'home.viewTimeline': 'Zur Zeitleiste →',
    'home.drillDueNow': 'Jetzt fällige drillen ({n})',
    'home.settings': 'Einstellungen',
    'home.settings.toggleAria': 'Einstellungen umschalten',
    'settings.case': 'Fall',
    'settings.number': 'Numerus',
    'settings.article': 'Artikel',
    'settings.case.all': 'Alle',
    'settings.case.nom': 'Nom',
    'settings.case.acc': 'Akk',
    'settings.case.dat': 'Dat',
    'settings.number.both': 'Beide',
    'settings.number.sg': 'Sg',
    'settings.number.pl': 'Pl',
    'settings.article.both': 'Beide',
    'settings.article.def': 'Bestimmt',
    'settings.article.indef': 'Unbestimmt',

    'vokabular.eyebrow': 'SCHLEIFER · VOKABULAR',
    'vokabular.h1': 'Übersetzen, passendes wählen.',
    'vokabular.sub': 'Multiple-Choice-Übersetzungen. Die Richtung wechselt pro Frage. {n} Nomen im Korpus.',
    'vokabular.start': 'Sitzung starten ({n} Karten)',
    'vokabular.starting': 'Beginnt…',
    'vokabular.drillDueNow': 'Jetzt fällige drillen ({n})',

    'session.endSession': 'Sitzung beenden',
    'session.placeholder': 'Artikel + Nomen eingeben…',
    'session.submit': 'Abschicken',
    'session.skip': 'Überspringen',
    'session.idk': 'Weiß ich nicht',
    'session.next': 'Weiter',
    'session.result.correct': 'Richtig',
    'session.result.typo': 'Fast — Tippfehler, akzeptiert',
    'session.result.idk': 'Als unbekannt markiert',
    'session.result.incorrect': 'Falsch',
    'session.result.articleMismatch': 'Richtige Form — falscher Artikel',
    'session.articleMismatch.usedDef': 'Du hast den bestimmten Artikel (der/die/das…) verwendet. Diese Karte verlangt den unbestimmten (ein…).',
    'session.articleMismatch.usedIndef': 'Du hast den unbestimmten Artikel (ein…) verwendet. Diese Karte verlangt den bestimmten (der/die/das…).',
    'session.youWrote': 'Du hast geschrieben',
    'session.answer': 'Antwort:',
    'session.nominativ': 'Nominativ:',
    'session.translation': 'Übersetzung:',
    'session.rule': 'Regel {n}:',
    'session.notFound': 'Sitzung nicht gefunden.',
    'session.loading': 'Lädt…',
    'session.summaryTitle': 'Sitzung abgeschlossen',
    'session.summaryH1': 'Gut gemacht.',
    'session.kbdSubmit': 'absenden',
    'session.kbdSkip': 'überspringen',
    'session.stats.correct': '{n} richtig',
    'session.stats.wrong': '{n} falsch',
    'session.stats.unknown': '{n} unbekannt',
    'session.stats.skipped': '{n} übersprungen',
    'session.correctHeading': 'Richtig ({n})',
    'session.missedHeading': 'Verfehlt ({n})',
    'session.didntKnow': 'wusste es nicht — Antwort: {x}',
    'session.wroteVsExpected': 'geschrieben: {x} · erwartet: {y}',
    'session.typoLabel': 'Tippfehler: {x}',
    'session.backToHome': 'Zurück zum Start',

    'vokabular.prompt.de': 'Was bedeutet das?',
    'vokabular.prompt.en': 'Welches deutsche Nomen passt?',
    'vokabular.answerLabel': 'Antwort',
    'vokabular.result.correct': 'Richtig',
    'vokabular.result.incorrect': 'Falsch',
    'vokabular.summaryH1': 'Gut gemacht.',

    'data.title': 'Daten',
    'data.lead':
      'Dein gesamter Fortschritt liegt in diesem Browser. Exportiere ihn in eine Datei, um ein Backup zu machen oder umzuziehen.',
    'data.counts.nouns': '{n} Nomen im Katalog',
    'data.counts.cards': '{n} Karten erzeugt',
    'data.counts.cardStates': '{n} Karten gelernt',
    'data.counts.sessions': '{n} Sitzungen',
    'data.counts.events': '{n} Aktivitätsereignisse',
    'data.exportBtn': 'JSON exportieren',
    'data.importBtn': 'JSON importieren…',
    'data.wipeBtn': 'Fortschritt löschen',
    'data.exportedMsg': 'Exportiert.',
    'data.importedMsg':
      'Importiert: {a} Kartenzustände, {b} Sitzungen, {c} Ereignisse.',
    'data.importFailed': 'Import fehlgeschlagen: {msg}',
    'data.importConfirm':
      'Beim Import werden alle aktuellen Fortschrittsdaten ERSETZT (Kartenzustände, Sitzungen, Ereignisse). Fortfahren?',
    'data.wipeConfirm':
      'Alle Fortschrittsdaten, Sitzungen und Aktivitätsereignisse dauerhaft löschen? Der Nomenkatalog bleibt erhalten.',
    'data.wipedMsg': 'Fortschritt gelöscht.',
    'data.backLink': '← Zurück zum Start',

    'rules.title': 'Genusregeln',
    'rules.lead':
      'Häufige Muster, um das Genus eines deutschen Nomens vorherzusagen. Heuristiken, keine absoluten Regeln — Ausnahmen gibt es.',
    'rules.rule': 'Regel {n}',
    'rules.expectedGender': 'Erwartetes Genus:',
    'rules.fromCatalog': 'Aus dem Katalog ({n})',
    'rules.andMore': '…und {n} weitere',
    'rules.tablesHeading': 'Artikel- und Fall-Tabellen',
    'rules.genderHeading': 'Genus-Heuristiken',
    'rules.moreTables': 'Weitere Tabellen & Referenzen',
    'rules.genderHeuristics': 'Genus-Heuristiken ({n})',
    'tabs.cases': 'Fälle',
    'tabs.articles': 'Artikel',
    'tabs.adjectives': 'Adjektive',
    'tabs.plurals': 'Plurale',
    'tabs.gender': 'Genusregeln',

    'gender.feminine': 'feminin',
    'gender.masculine': 'maskulin',
    'gender.neuter': 'neutrum',
    'gender.varies': 'variiert',
  },
};

const RULE_TITLES_DE: Record<number, string> = {
  1: 'Nomen auf -ung sind meist feminin',
  2: 'Nomen auf -heit oder -keit sind meist feminin',
  3: 'Nomen auf -schaft sind meist feminin',
  4: 'Nomen auf -tion, -sion oder -ion sind meist feminin',
  5: 'Verkleinerungsformen auf -chen oder -lein sind neutrum',
  6: 'Nomen auf -ment sind meist neutrum',
  7: 'Nomen auf -um sind meist neutrum',
  8: 'Nomen auf -ismus sind meist maskulin',
  9: 'Viele Personen-/Berufsnomen auf -er sind maskulin',
  10: 'Tage, Monate und Jahreszeiten sind maskulin',
  11: 'Viele Bäume, Blumen und Pflanzen sind feminin',
  12: 'Junge Menschen und junge Tiere sind oft neutrum',
  13: 'Metalle und chemische Elemente sind meist neutrum',
  14: 'Verb-Infinitive als Nomen sind neutrum',
  15: 'Komposita erben das Genus des letzten Nomens',
  16: 'Nomen auf -ik sind meist feminin',
  17: 'Nomen auf -ei sind meist feminin',
  18: 'Konkrete einsilbige Gegenstandsnomen sind oft maskulin',
  19: 'Weibliche Personen-/Tiernomen auf -in sind feminin',
  20: 'Nomen auf -or sind oft maskulin',
  21: 'Nomen auf -ling sind meist maskulin',
  22: 'Nomen auf -tät sind feminin',
  23: 'Nomen auf -enz oder -anz sind meist feminin',
  24: 'Nomen auf -age oder -ur sind oft feminin',
  25: 'Nomen auf -nis sind oft neutrum, manchmal feminin',
  99: 'Keine verlässliche Regel; mit Artikel auswendig lernen',
};

const RULE_FEEDBACK_DE: Record<number, string> = {
  1: 'Wörter auf -ung sind meist feminin, sie nehmen also normalerweise „die".',
  2: 'Wörter auf -heit oder -keit sind meist feminin, sie nehmen also normalerweise „die".',
  3: 'Wörter auf -schaft sind meist feminin, sie nehmen also normalerweise „die".',
  4: 'Viele gelehrte/lateinstämmige Wörter auf -tion, -sion oder -ion sind feminin.',
  5: 'Deutsche Verkleinerungsformen auf -chen oder -lein sind immer neutrum, auch wenn die Person oder das Tier weiblich ist.',
  6: 'Viele Nomen auf -ment sind neutrum, sie nehmen also oft „das".',
  7: 'Viele Nomen auf -um sind neutrum, vor allem gelehrte/lateinstämmige Wörter.',
  8: 'Ideologie-/Systemnomen auf -ismus sind meist maskulin.',
  9: 'Viele Personen- oder Berufsnomen auf -er sind maskulin.',
  10: 'Tage, Monate und Jahreszeiten sind im Deutschen meist maskulin.',
  11: 'Viele Bäume-, Blumen- und Pflanzennamen sind im Deutschen feminin.',
  12: 'Wörter für junge Menschen oder Tiere sind oft neutrum.',
  13: 'Metalle und viele chemische Elemente sind meist neutrum.',
  14: 'Wenn ein Infinitiv als Nomen benutzt wird, ist es neutrum.',
  15: 'Bei Komposita bestimmt der letzte Bestandteil das Genus.',
  16: 'Viele Nomen auf -ik, vor allem Fachgebiete oder Systeme, sind feminin.',
  17: 'Viele Nomen auf -ei sind feminin, besonders Geschäfte, Orte oder Vorgänge.',
  18: 'Viele kurze, konkrete Gegenstandsnomen sind maskulin, aber das ist nur eine schwache Faustregel.',
  19: 'Weibliche Personen- oder Tiernomen auf -in sind feminin.',
  20: 'Viele Nomen auf -or sind maskulin, besonders Rollen, Geräte und Fachbegriffe.',
  21: 'Nomen auf -ling sind meist maskulin.',
  22: 'Abstrakte Nomen auf -tät sind feminin.',
  23: 'Abstrakte Nomen auf -enz oder -anz sind meist feminin.',
  24: 'Viele Lehnwörter auf -age oder -ur sind feminin.',
  25: 'Viele Nomen auf -nis sind neutrum, aber einige gängige sind feminin — Artikel beachten.',
  99: 'Dieses Nomen passt zu keiner starken allgemeinen Regel. Mit dem Artikel zusammen lernen.',
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.loadLang());

  setLang(l: Lang) {
    this.lang.set(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }

  toggle() {
    this.setLang(this.lang() === 'de' ? 'en' : 'de');
  }

  /** Translate a key, with optional {placeholder} substitution. */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = DICT[this.lang()] ?? DICT.de;
    let s = dict[key] ?? DICT.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return s;
  }

  /** Localized rule title for the current language. */
  ruleTitle(id: number, fallback: string): string {
    if (this.lang() === 'de') return RULE_TITLES_DE[id] ?? fallback;
    return fallback;
  }

  /** Localized rule feedback message for the current language. */
  ruleFeedback(id: number, fallback: string): string {
    if (this.lang() === 'de') return RULE_FEEDBACK_DE[id] ?? fallback;
    return fallback;
  }

  /** Translate the gender token (feminine/masculine/neuter/varies). */
  gender(g: string): string {
    const k = `gender.${g.trim().toLowerCase()}`;
    const dict = DICT[this.lang()];
    return dict[k] ?? g;
  }

  /**
   * Localized "due" string. Anything past-due (or right now) collapses to
   * "now" / "jetzt" — there's no value in telling the user a card was due
   * three days ago; the only thing that matters is "do it now".
   */
  dueTime(ts: number | null, now = Date.now()): string {
    if (ts === null) return '—';
    if (ts <= now) return this.t('progress.now');
    return this.relTime(ts, now);
  }

  /** Localized relative-time string ("vor 3 Tagen" / "in 5 days" / "now"). */
  relTime(ts: number | null, now = Date.now()): string {
    if (ts === null) return '—';
    const diffMs = ts - now;
    const absMs = Math.abs(diffMs);
    if (absMs < 60_000) return this.t('progress.now');
    const locale = this.lang() === 'de' ? 'de-DE' : 'en-US';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const minutes = Math.round(diffMs / 60_000);
    const hours = Math.round(diffMs / 3_600_000);
    const days = Math.round(diffMs / 86_400_000);
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
    return rtf.format(days, 'day');
  }

  private loadLang(): Lang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'de') return stored;
    } catch {}
    return 'de';
  }
}
