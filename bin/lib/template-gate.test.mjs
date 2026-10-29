import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { GATE_MESSAGES, GATE_SAYS, RENDERED_FRESH_HOURS, decidePage, freeReason, pageTarget, shownReport } from './template-gate.mjs';
import { cutSpans } from './rules-coverage.mjs';
import { RENDERED_SCHEMA, normalText, sha256 } from './template-record.mjs';

const NOW = Date.parse('2026-10-29T06:00:00.000Z');
const hoursAgo = (hours) => new Date(NOW - hours * 3600 * 1000).toISOString();
const PAGE = '<!doctype html>\n<html><body class="jh-moment"><h1>Vuelves</h1></body></html>\n';
const rendered = (text, at = hoursAgo(1)) => ({
  schema: RENDERED_SCHEMA, template: 'stretch-return', subject: 's-7', sha256: sha256(text), normal: sha256(normalText(text)),
  bytes: text.length, at, head: 'abc', path: '/x/return.html',
});
const TEMPLATES = [{ id: 'stretch-return', surface: 'page', render: 'js-harness stretch close --html', signature: 'jh-moment' }];
const FILE = '/h/.js-harness/throughput/p/templates-rendered.jsonl';
const decide = (page, extra = {}) => decidePage({ page, rendered: [], templates: TEMPLATES, openMoments: [], now: NOW, renderedPath: FILE, ...extra });
const FREE = '<meta name="js-harness-page" content="free: a research page on the gate, for him">';

test('pageTarget reads an Artifact publish of a page, file by file, and a widget by its code', () => {
  assert.deepEqual(pageTarget('Artifact', { file_path: 'D:/t/p.html', icon: 'chart' }), { files: ['D:/t/p.html'] });
  assert.deepEqual(pageTarget('Artifact', { action: 'publish', file_path: 'notes.md', url: 'u' }), { files: ['notes.md'] });
  assert.deepEqual(pageTarget('Artifact', { file_path: 'p.html', files: { 'a.html': 'src/a.html', 'b.css': 'src/b.css', 'c.html': { from: 'src/c.html' }, 'd.html': null } }), { files: ['p.html', 'src/a.html', 'src/c.html'] });
  assert.deepEqual(pageTarget('mcp__visualize__show_widget', { title: 't', widget_code: '<p>x</p>' }), { widget: '<p>x</p>' });
});

test('pageTarget reads files given as a list, and a files source under the publish\'s root', () => {
  assert.deepEqual(pageTarget('Artifact', { files: [{ path: 'a.html' }, { path: 'b.png' }, { path: 'c.md', contentType: 'text/markdown' }] }), { files: ['a.html', 'c.md'] });
  assert.deepEqual(pageTarget('Artifact', { file_path: 'p.html', root: 'site', files: { 'a.html': 'src/a.html', 'b.html': { from: 'b.html' } } }), { files: ['p.html', path.join('site', 'src/a.html'), path.join('site', 'b.html')] });
  assert.deepEqual(pageTarget('Artifact', { root: 'site', files: [{ path: 'a.html' }] }), { files: [path.join('site', 'a.html')] });
  const absolute = path.resolve('elsewhere', 'a.html');
  assert.deepEqual(pageTarget('Artifact', { root: 'site', files: { 'a.html': absolute } }), { files: [absolute] });
});

test('an Artifact call that shows no page is not the gate\'s', () => {
  for (const input of [
    { action: 'read', url: 'u' }, { action: 'open', url: 'u' }, { action: 'list' }, { action: 'quickstart', intent: 'other' },
    { url: 'u', file_path: 'logo.png', asset: true }, { type_url: 't', title: 'Deck' }, { file_path: 'data.json', url: 'u' },
  ]) assert.equal(pageTarget('Artifact', input), null, JSON.stringify(input));
  assert.equal(pageTarget('ArtifactData', { action: 'set' }), null);
  assert.equal(pageTarget('mcp__visualize__show_widget', {}), null);
});

test('a page whose bytes a template command recorded within the hours is admitted as that template', () => {
  const decision = decide({ text: PAGE }, { rendered: [rendered(PAGE)] });
  assert.equal(decision.decision, 'admitted');
  assert.equal(decision.template, 'stretch-return');
  assert.equal(decision.subject, 's-7');
  assert.equal(decision.sha256, sha256(PAGE));
});

test('an old page published again as a new moment\'s is refused', () => {
  const decision = decide({ text: PAGE }, { rendered: [rendered(PAGE, hoursAgo(RENDERED_FRESH_HOURS + 0.5))] });
  assert.equal(decision.decision, 'refused');
});

test('a widget is admitted only when its code is the recorded file\'s text; a retyped one is refused naming Artifact', () => {
  const asCarried = `${PAGE.replace(/\n/g, '  \r\n')}\n\n`;
  assert.equal(decide({ widget: asCarried }, { rendered: [rendered(PAGE)] }).decision, 'admitted');
  const retyped = decide({ widget: PAGE.replace('Vuelves', 'Volviste') }, { rendered: [rendered(PAGE)] });
  assert.equal(retyped.decision, 'refused');
  assert.match(retyped.reason, /Artifact/);
});

test('a page marked free with its reason is admitted as free when no template shows in it and no moment is open', () => {
  const decision = decide({ text: `<html><head>${FREE}</head><body>research</body></html>` });
  assert.equal(decision.decision, 'free');
  assert.equal(decision.reason, 'a research page on the gate, for him');
});

test('a free mark\'s reason ends at the quote that opened it, so an apostrophe in a double-quoted reason is kept', () => {
  assert.equal(freeReason('<meta name="js-harness-page" content="free: the lead\'s research page on the gate">'), 'the lead\'s research page on the gate');
  assert.equal(freeReason('<meta name=\'js-harness-page\' content=\'free: a page quoting "the gate" for him\'>'), 'a page quoting "the gate" for him');
  assert.equal(freeReason('<meta name="js-harness-page" content="free: a research page\n  on the gate, for him">'), 'a research page\n  on the gate, for him', 'a reason may wrap onto a second line');
});

test('a free mark whose reason is under 20 characters is no mark', () => {
  assert.equal(freeReason('<meta name="js-harness-page" content="free: short">'), null);
  assert.equal(decide({ text: '<meta name="js-harness-page" content="free: short"><p>x</p>' }).decision, 'refused');
});

test('the 02:44Z case: a page with a template\'s signature and no recorded hash is refused, by widget and by Artifact, marked free or not', () => {
  const handMade = '<div class="jh-moment"><h2>Plan de 8 horas</h2></div>';
  for (const page of [{ text: handMade }, { widget: handMade }, { text: `${FREE}${handMade}` }, { widget: `${FREE}${handMade}` }]) {
    const decision = decide(page);
    assert.equal(decision.decision, 'refused', JSON.stringify(page));
    assert.match(decision.reason, /stretch-return/);
  }
});

test('a page marked free while a moment of a page template is open is refused, naming the moment', () => {
  const decision = decide({ text: `${FREE}<p>todo bien</p>` }, { openMoments: [{ template: 'stretch-return', subject: 's-8' }] });
  assert.equal(decision.decision, 'refused');
  assert.match(decision.reason, /s-8/);
});

test('the refusal says what came from no command, where it looked, the command to run and how to mark a free page', () => {
  const { reason, decision } = decide({ text: '<p>hecho a mano</p>' });
  assert.equal(decision, 'refused');
  assert.equal(reason, `js-harness template gate: this page came from no template command (sha256 ${sha256('<p>hecho a mano</p>').slice(0, 12)} is not in ${FILE}). `
    + 'Make it with its command and publish that file unchanged: stretch-return: js-harness stretch close --html. '
    + 'If no record holds what it shows, mark it free: <meta name="js-harness-page" content="free: <why, 20 characters or more>">.');
});

test('with no page template registered, the refusal says so in place of a command', () => {
  const { reason } = decide({ text: '<p>x</p>' }, { templates: [] });
  assert.match(reason, /no page template is registered yet/);
});

test('every refusal is sentences of GATE_SAYS with their slots filled, and GATE_MESSAGES cuts into those sentences', () => {
  const pattern = (sentence) => sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<\w+>/g, '.+');
  const whole = new RegExp(`^(?:(?:${Object.values(GATE_SAYS).map(pattern).join('|')}) ?)+$`);
  const reasons = [
    decide({ text: '<p>x</p>' }).reason,
    decide({ text: '<p>x</p>' }, { templates: [] }).reason,
    decide({ text: '<div class="jh-moment">x</div>' }).reason,
    decide({ text: '<p>x</p>' }, { openMoments: [{ template: 'stretch-return', subject: 's-8' }] }).reason,
    decide({ widget: '<p>x</p>' }).reason,
  ];
  for (const reason of reasons) assert.match(reason, whole);
  assert.deepEqual(cutSpans(GATE_MESSAGES).map((span) => span.text.trim()), Object.values(GATE_SAYS));
});

test('shownReport counts each template\'s decisions, lists free pages and names a moment no page was shown for', () => {
  const line = (decision, extra = {}) => ({ at: hoursAgo(1), decision, template: 'stretch-return', subject: 's-7', reason: null, ...extra });
  const report = shownReport({
    rendered: [rendered(PAGE)],
    shown: [line('refused'), line('admitted'), line('shown'), line('free', { template: null, subject: null, reason: 'a research page for him' }), line('unchecked', { template: null, subject: null })],
    moments: [{ template: 'stretch-return', subject: 's-7' }, { template: 'stretch-return', subject: 's-8' }],
  });
  assert.deepEqual(report.templates, { 'stretch-return': { rendered: 1, admitted: 1, shown: 1, refused: 1, unchecked: 0 } });
  assert.deepEqual(report.free, [{ at: hoursAgo(1), reason: 'a research page for him' }]);
  assert.deepEqual(report.escapes, ['the moment s-8 of stretch-return shows no page']);
  assert.equal(report.unchecked, 1);
});

test('shownReport counts a template whose id is a name objects inherit, such as constructor, from zero', () => {
  const line = (decision) => ({ at: hoursAgo(1), decision, template: 'constructor', subject: 's-1', reason: null });
  const report = shownReport({ rendered: [{ ...rendered(PAGE), template: 'constructor' }], shown: [line('admitted'), line('shown')], moments: [] });
  assert.deepEqual(report.templates, { constructor: { rendered: 1, admitted: 1, shown: 1, refused: 0, unchecked: 0 } });
});

test('a page decoded from bytes that are not UTF-8 is matched by its bytes, as the record hashed them', () => {
  const bytes = Buffer.from([0x3c, 0x70, 0x3e, 0xe9, 0x3c, 0x2f, 0x70, 0x3e]);
  const line = { ...rendered(PAGE), sha256: sha256(bytes) };
  assert.equal(decide({ bytes, text: bytes.toString('utf8') }, { rendered: [line] }).decision, 'admitted');
});

test('shownReport names a shown page whose rendered line names no moment, and holds with nothing recorded', () => {
  const orphan = { at: hoursAgo(2), decision: 'shown', template: 'stretch-return', subject: null, reason: null };
  assert.deepEqual(shownReport({ rendered: [], shown: [orphan], moments: [] }).escapes, [`a page of stretch-return shown at ${hoursAgo(2)} names no moment`]);
  assert.deepEqual(shownReport({ rendered: [], shown: [], moments: [] }), { templates: {}, free: [], escapes: [], unchecked: 0 });
});
