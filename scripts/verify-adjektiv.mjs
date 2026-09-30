// Data-contract + grammar smoke check for the adjective area. Pure node, no
// browser: validates that every adjective pairing points at a real corpus
// noun, that each adjective spans all three genders (so every ending cell can
// render), and that the ending table produces the expected forms for a few
// known phrases. Run: `node scripts/verify-adjektiv.mjs`
import { readFileSync } from 'node:fs';

const nouns = JSON.parse(readFileSync('src/assets/nouns.json', 'utf8')).nouns;
const adj = JSON.parse(readFileSync('src/assets/adjectives.json', 'utf8'));
const byId = new Map(nouns.map((n) => [n.id, n]));

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL:', msg); };

// --- data contract ---
console.log('--- adjectives.json contract ---');
const ids = new Set();
for (const a of adj.adjectives) {
  if (ids.has(a.id)) fail(`duplicate adjective id: ${a.id}`);
  ids.add(a.id);
  if (!a.base || !a.en) fail(`${a.id}: missing base/en`);
  const genders = new Set();
  for (const nid of a.nounIds) {
    const n = byId.get(nid);
    if (!n) { fail(`${a.id}: unknown noun id ${nid}`); continue; }
    genders.add(n.gender);
  }
  for (const g of ['m', 'f', 'n']) {
    if (!genders.has(g)) fail(`${a.id}: no ${g} noun — cannot render that gender`);
  }
}
console.log(`  ${adj.adjectives.length} adjectives checked`);

// --- ending table smoke test (mirrors src/app/core/adjective.ts) ---
const DEF_SG = { m: { nom: 'der', acc: 'den', dat: 'dem' }, f: { nom: 'die', acc: 'die', dat: 'der' }, n: { nom: 'das', acc: 'das', dat: 'dem' } };
const DEF_PL = { nom: 'die', acc: 'die', dat: 'den' };
const INDEF_SG = { m: { nom: 'ein', acc: 'einen', dat: 'einem' }, f: { nom: 'eine', acc: 'eine', dat: 'einer' }, n: { nom: 'ein', acc: 'ein', dat: 'einem' } };
const MEIN_PL = { nom: 'meine', acc: 'meine', dat: 'meinen' };
const E = {
  weak: { sg: { nom: { m: 'e', f: 'e', n: 'e' }, acc: { m: 'en', f: 'e', n: 'e' }, dat: { m: 'en', f: 'en', n: 'en' } }, pl: { nom: 'en', acc: 'en', dat: 'en' } },
  mixed: { sg: { nom: { m: 'er', f: 'e', n: 'es' }, acc: { m: 'en', f: 'e', n: 'es' }, dat: { m: 'en', f: 'en', n: 'en' } }, pl: { nom: 'en', acc: 'en', dat: 'en' } },
  strong: { sg: { nom: { m: 'er', f: 'e', n: 'es' }, acc: { m: 'en', f: 'e', n: 'es' }, dat: { m: 'em', f: 'er', n: 'em' } }, pl: { nom: 'e', acc: 'e', dat: 'en' } },
};
const stemOf = (a) => a.stem ?? a.base;
const dativePlural = (p) => (/[ns]$/.test(p) ? p : p + 'n');
function phrase(aId, nId, cls, num, cs) {
  const a = adj.adjectives.find((x) => x.id === aId);
  const n = byId.get(nId);
  const end = num === 'pl' ? E[cls].pl[cs] : E[cls].sg[cs][n.gender];
  const adjForm = stemOf(a) + end;
  let art = '';
  if (cls === 'weak') art = (num === 'pl' ? DEF_PL[cs] : DEF_SG[n.gender][cs]) + ' ';
  else if (cls === 'mixed') art = (num === 'pl' ? MEIN_PL[cs] : INDEF_SG[n.gender][cs]) + ' ';
  const noun = num === 'pl' ? (cs === 'dat' ? dativePlural(n.plural) : n.plural) : n.singular;
  return `${art}${adjForm} ${noun}`;
}

console.log('--- ending-table smoke test ---');
const cases = [
  ['schoen', 'fenster', 'mixed', 'sg', 'nom', 'ein schönes Fenster'],
  ['gut', 'wein', 'weak', 'sg', 'dat', 'dem guten Wein'],
  ['gut', 'wein', 'mixed', 'sg', 'nom', 'ein guter Wein'],
  ['gut', 'wasser', 'strong', 'sg', 'dat', 'gutem Wasser'],
  ['gut', 'wein', 'mixed', 'pl', 'dat', 'meinen guten Weinen'],
  ['hoch', 'haus', 'mixed', 'sg', 'nom', 'ein hohes Haus'],
  ['teuer', 'auto', 'strong', 'sg', 'dat', 'teurem Auto'],
  ['dunkel', 'zimmer', 'weak', 'sg', 'nom', 'das dunkle Zimmer'],
];
for (const [a, n, cls, num, cs, want] of cases) {
  const got = phrase(a, n, cls, num, cs);
  if (got !== want) fail(`${a}+${n} ${cls}/${num}/${cs}: got "${got}", want "${want}"`);
  else console.log(`  ok  ${got}`);
}

console.log(failures === 0 ? '\nOK — adjective area verified.' : `\n${failures} FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
