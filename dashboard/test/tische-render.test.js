const { test } = require('node:test');
const assert = require('node:assert/strict');
const { listHtml, detailHtml } = require('../media/tische.js');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

test('list shows lock, tokens, unreachable', () => {
  const html = listHtml([{ id: 'a', titel: 'X<y', datum: '2026-10-26', blasen: ['b1'], vertraulich: true, sitze: 4, tokensGesamt: 1234, erreichbar: false }], esc);
  assert.match(html, /data-tisch="a"/); assert.match(html, /🔒/); assert.match(html, /X&lt;y/);
  assert.match(html, /1\.234|1234/); assert.match(html, /nicht erreichbar/);
});
test('detail groups by round, highlights interventions and variants', () => {
  const html = detailHtml({ id: 'a', erreichbar: true, tokensProSitz: { pro: 10 }, tokensProRunde: { 1: 10 }, tokensGesamt: 10,
    meta: { titel: 'T', sitze: [{ id: 'pro', rolle: 'Pro', modell: 'sonnet', blase: 'b1' }], runden: [{ nr: 1, titel: 'Getrennt' }] },
    eintraege: [
      { runde: 1, von: 'pro', art: 'beitrag', text: 'Hallo', tokens: 10 },
      { runde: 1, von: 'moderator', art: 'eingriff', text: 'Runde 1 fertig', eingriff: { grund: 'G', optionen: ['o1', 'o2'], auto: true } },
      { runde: 1, von: 'moderator', art: 'variante', text: 'V', aenderung: 'Haiku statt Sonnet', tokens_vorher: 100, tokens_nachher: 30 }
    ] }, esc);
  assert.match(html, /Runde 1 · Getrennt/); assert.match(html, /class="tisch-eingriff"/);
  assert.match(html, /o1/); assert.match(html, /class="tisch-variante"/); assert.match(html, /100 → 30/);
  assert.match(html, /Pro · sonnet/);
});
test('detail shows legend when meta.legende is set', () => {
  const html = detailHtml({ id: 'a', erreichbar: true, tokensProSitz: {}, tokensProRunde: {}, tokensGesamt: 0, meta: { titel: 'T', sitze: [], runden: [], legende: { D: 'Person <A>' } }, eintraege: [] }, esc);
  assert.match(html, /class="tisch-legende"/); assert.match(html, /Person &lt;A&gt;/);
});
