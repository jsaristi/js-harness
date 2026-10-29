import assert from 'node:assert/strict';
import test from 'node:test';
import { chain, escapeHtml, page, pill, shareText, table, tiles, timeline } from './pages.mjs';

test('a page is one fragment that opens with its title, its tokens scoped to its wrapper, bad news first', () => {
  const html = page({ title: 'Regreso <1>', heading: 'Lo que pasó', lead: 'De 12:11Z a 22:54Z', badNews: ['No se abrió un tramo'], sections: [{ title: 'Metas', html: '<p>x</p>', note: 'nota' }] });
  assert.match(html, /^<title>Regreso &lt;1&gt;<\/title>/);
  assert.doesNotMatch(html, /:root\s*\{/, 'a fragment shown inside a host page leaves the host\'s :root alone');
  assert.match(html, /\.js-page\{/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.ok(html.indexOf('No se abrió un tramo') < html.indexOf('Metas'), 'the bad news comes before the sections');
  assert.match(html, /<h2>Metas<\/h2><p>x<\/p><p class="note">nota<\/p>/);
});

test('a page with no bad news has no box for it', () => {
  assert.doesNotMatch(page({ title: 't', heading: 'h', sections: [] }), /class="badnews"/);
});

test('the bad-news box has a class of its own: a timeline\'s failure dot is no box', () => {
  const html = page({ title: 't', heading: 'h', badNews: ['x'], sections: [] });
  assert.match(html, /<div class="badnews">/);
  assert.doesNotMatch(html, /\.js-page \.bad\{/, 'no rule for .bad alone, which the dot also carries');
});

test('every text from a record is escaped, so a page shows it and never runs it', () => {
  assert.equal(escapeHtml(`<b a="1">'&`), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;');
  const html = table(['Qué'], [['<script>x</script>']]);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('a share over nothing is said as such, an unknown one is not a zero', () => {
  assert.equal(shareText({ met: 3, of: 4 }), '75 %');
  assert.equal(shareText({ met: 0, of: 0 }), 'nada que medir');
  assert.equal(shareText(null), 'nada que medir');
  assert.equal(shareText({ met: null, of: 4, unknown: 4 }), 'sin medir');
});

test('a tile shows its big value, a meter at its share and its caption; one with no share has no meter', () => {
  const html = tiles([{ value: '75 %', share: 0.75, caption: '3 de 4' }, { value: '+5', caption: 'fuera del plan' }]);
  assert.match(html, /75 %[\s\S]*width:75%[\s\S]*3 de 4/);
  assert.equal(html.match(/class="meter"/g).length, 1);
});

test('a cell may be a pill or a mono number, and a cell object\'s text is escaped too', () => {
  const html = table(['A', 'B'], [[{ text: '95/107', mono: true }, { pill: pill('hecho <x>', 'ok') }]]);
  assert.match(html, /<td class="num">95\/107<\/td>/);
  assert.match(html, /<span class="pill ok">hecho &lt;x&gt;<\/span>/);
});

test('the timeline lists each event at its UTC time with a dot of its kind, oldest first as given', () => {
  const html = timeline([{ at: '2026-10-28T12:11:00Z', kind: 'mark', text: 'Te vas' }, { at: '2026-10-28T12:19:30Z', kind: 'bad', text: 'Falla <1>' }]);
  assert.match(html, /12:11Z[\s\S]*dot mark[\s\S]*Te vas[\s\S]*12:19Z[\s\S]*dot bad[\s\S]*Falla &lt;1&gt;/);
});

test('the chain draws each step in order by its state, and outlines the ones that moved', () => {
  const html = chain([{ id: 'S0', state: 'done' }, { id: 'S11', state: 'moving', moved: true }, { id: 'S13', state: 'todo' }]);
  assert.match(html, /step done">S0[\s\S]*step moving moved">S11[\s\S]*step todo">S13/);
});
