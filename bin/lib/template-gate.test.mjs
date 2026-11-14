import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {
  DROP_REASON_CHARS, GATE_MESSAGES, GATE_SAYS, RENDERED_FRESH_HOURS, YOURS_LEVEL, askTarget, decideAsk, decidePage, decideSummary, freeReason,
  pageTarget, shownReport, summaryChanges, yoursAfter, yoursKey,
} from './template-gate.mjs';
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

// The board summary's writes (odd/tasks/board-summary-stale.md, S2): what an ArtifactData call writes to board/summary.
test('summaryChanges reads each set, update, str_replace or batch entry of board/summary, its action and its source', () => {
  const base = { url: 'u', collection: 'board', doc_id: 'summary' };
  assert.deepEqual(summaryChanges('ArtifactData', { ...base, action: 'update', data: { now: 'x' } }), [{ action: 'update', data: { now: 'x' } }]);
  assert.deepEqual(summaryChanges('ArtifactData', { ...base, action: 'set', file_path: 'b.json' }), [{ action: 'set', file: 'b.json' }]);
  assert.deepEqual(summaryChanges('ArtifactData', { ...base, action: 'str_replace', field: 'status', old_str: 'a', new_str: 'b' }), [{ action: 'str_replace', field: 'status' }]);
  assert.deepEqual(summaryChanges('ArtifactData', { ...base, action: 'delete' }), [{ action: 'delete' }]);
  const batch = { url: 'u', action: 'batch', writes: [
    { op: 'set', collection: 'events', doc_id: 'e1', data: { rows: [] } },
    { op: 'update', collection: 'board', doc_id: 'summary', file_path: 'c.json' },
  ] };
  assert.deepEqual(summaryChanges('ArtifactData', batch), [{ action: 'update', file: 'c.json' }]);
});

test('a call that writes no board/summary is not a summary write', () => {
  const base = { url: 'u', collection: 'board', doc_id: 'summary' };
  for (const [tool, input] of [
    ['ArtifactData', { ...base, action: 'get' }], ['ArtifactData', { ...base, action: 'list' }],
    ['ArtifactData', { ...base, action: 'update', doc_id: 'other', data: { now: 'x' } }],
    ['ArtifactData', { ...base, action: 'update', collection: 'events', data: { now: 'x' } }],
    ['ArtifactData', { url: 'u', action: 'batch', writes: [{ op: 'set', collection: 'events', doc_id: 'e1', data: {} }] }],
    ['ArtifactData', { url: 'u', action: 'batch', writes: 'no list' }], ['ArtifactData', null],
    ['Artifact', { ...base, action: 'update', data: { now: 'x' } }],
  ]) assert.equal(summaryChanges(tool, input), null, JSON.stringify([tool, input]));
});

// The directives audit, C4 (odd/tasks/audit-cement.md, spec 6): an item leaves the board's yours only with a reason.
test('yoursKey is an item without the level the board shows it with, as docs/live-board.html reads it', () => {
  assert.equal(yoursKey('URGENTE · Revisa el PR 867 '), 'Revisa el PR 867');
  assert.equal(yoursKey('opciones: elige'), 'elige');
  assert.equal(yoursKey('  sin nivel '), 'sin nivel');
  const board = fs.readFileSync(new URL('../../docs/live-board.html', import.meta.url), 'utf8');
  const regex = /function yoursLevel\(item\) \{\s*const match = (\/.+\/i)\.exec\(item\);/.exec(board)?.[1];
  assert.equal(regex, String(YOURS_LEVEL), 'the gate and the board read a level the same way');
});

test('yoursAfter is the list a call leaves: a set or update that carries it, a set without it or a delete empties it, and what is not known is null', () => {
  const after = (...changes) => yoursAfter(changes);
  assert.deepEqual(after({ action: 'update', data: { now: 'x' } }), { yours: undefined, named: [] });
  assert.deepEqual(after({ action: 'update', data: { yours: ['a', 3, 'b'] } }).yours, ['a', 'b']);
  assert.deepEqual(after({ action: 'update', data: { yours: 'a' } }).yours, [], 'a yours the board cannot list shows nothing');
  assert.deepEqual(after({ action: 'set', data: { now: 'x' } }).yours, []);
  assert.deepEqual(after({ action: 'delete' }).yours, []);
  assert.equal(after({ action: 'str_replace', field: 'yours' }).yours, null);
  assert.equal(after({ action: 'str_replace', field: 'status' }).yours, undefined);
  assert.equal(after({ action: 'update', unreadable: 'cannot read b.json (ENOENT)' }).yours, null);
  assert.deepEqual(after({ action: 'delete' }, { action: 'update', data: { yours: ['a'] } }).yours, ['a'], 'a batch in order');
  const named = { item: 'a', reason: 'decided in PR 867' };
  assert.deepEqual(after({ action: 'update', data: { yours: [], yoursDropped: [named] } }).named, [named]);
});

test('decideSummary refuses a write that drops an item of the last recorded yours without a reason in yoursDropped', () => {
  const update = (data) => [{ action: 'update', data }];
  const previous = ['URGENTE · Revisa el PR 867', 'Elige el nombre'];
  assert.equal(decideSummary({ changes: update({ now: 'x' }), previous }).decision, 'admitted', 'yours untouched');
  assert.equal(decideSummary({ changes: update({ yours: [] }), previous: undefined }).decision, 'admitted', 'no list recorded yet');
  assert.equal(decideSummary({ changes: update({ yours: ['Revisa el PR 867', 'Elige el nombre', 'nuevo'] }), previous }).decision, 'admitted', 'a level changed is the same item');
  const refused = decideSummary({ changes: update({ yours: ['Elige el nombre'] }), previous });
  assert.equal(refused.decision, 'refused');
  assert.ok(refused.reason.includes('"Revisa el PR 867"'), refused.reason);
  assert.ok(refused.reason.includes('yoursDropped: [{ item, reason }]'), refused.reason);
  assert.ok(refused.reason.includes(`${DROP_REASON_CHARS} characters`), refused.reason);
  const dropped = (reason) => update({ yours: ['Elige el nombre'], yoursDropped: [{ item: 'URGENTE · Revisa el PR 867', reason }] });
  assert.equal(decideSummary({ changes: dropped('merged as 96ce3c9'), previous }).decision, 'admitted');
  assert.equal(decideSummary({ changes: dropped('done'), previous }).decision, 'refused', 'a reason under the length');
  assert.equal(decideSummary({ changes: [{ action: 'delete' }], previous }).decision, 'refused', 'a delete drops all');
  assert.equal(decideSummary({ changes: [{ action: 'set', data: { now: 'x' } }], previous }).decision, 'refused', 'a set without yours drops all');
  // Codex P2 on 7c4f91fd: a reason counts only in the write that drops the item, not one a later write of the batch erases.
  const erased = [{ action: 'update', data: { yoursDropped: [{ item: 'Revisa el PR 867', reason: 'merged as 96ce3c9' }] } }, { action: 'set', data: { yours: ['Elige el nombre'] } }];
  assert.equal(decideSummary({ changes: erased, previous }).decision, 'refused');
  const inBatch = [{ action: 'update', data: { yours: ['a'] } }, { action: 'update', data: { yours: [] } }];
  assert.equal(decideSummary({ changes: inBatch, previous: undefined }).decision, 'refused', 'a list set earlier in the batch is held too');
  const reworded = decideSummary({ changes: update({ yours: ['Revisa el PR 868', 'Elige el nombre'] }), previous });
  assert.equal(reworded.decision, 'refused', 'a reworded item leaves as the old one');
  // The reliability lens on 7c4f91fd: a str_replace of yours would leave the next write nothing to hold it to.
  const replaced = decideSummary({ changes: [{ action: 'str_replace', field: 'yours' }], previous });
  assert.equal(replaced.decision, 'refused');
  assert.match(replaced.reason, /str_replace cannot change yours/);
  assert.equal(decideSummary({ changes: [{ action: 'str_replace', field: 'yours' }], previous: undefined }).decision, 'refused', 'with no list before it too');
  for (const [changes, prior] of [[update({ yours: [] }), null], [[{ action: 'set', unreadable: 'cannot read b.json (ENOENT)' }], previous]]) {
    const unknown = decideSummary({ changes, previous: prior, previousWhy: 'the record could not be read' });
    assert.equal(unknown.decision, 'unchecked', JSON.stringify(changes));
    assert.match(unknown.reason, /goes through unchecked/);
  }
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

// The `ask` surface: each question of a call of the question tool, against the channel's record.
const CHANNEL = '/h/.js-harness/channel/p.jsonl';
const RECORDED = { number: 4, notice: { text: '¿Seguimos con el tramo C?', options: [{ label: 'Sí (Recomendada)', description: 'a' }, { label: 'No', description: 'b' }] }, closed: null };
const AS_RENDERED = { question: 'Pregunta 4: ¿Seguimos con el tramo C?', header: 'Pregunta 4', multiSelect: false, options: RECORDED.notice.options };

test('askTarget reads each question of a call of the question tool, and nothing else', () => {
  assert.deepEqual(askTarget('AskUserQuestion', { questions: [AS_RENDERED] }), { asks: [AS_RENDERED] });
  assert.equal(askTarget('AskUserQuestion', { questions: 'x' }), null);
  assert.equal(askTarget('Artifact', { questions: [AS_RENDERED] }), null);
});

test('the ask gate admits a question as its template renders it, and refuses one typed by hand naming notify and template ask', () => {
  const admitted = decideAsk({ asked: AS_RENDERED, questions: [RECORDED], recordPath: CHANNEL });
  assert.deepEqual({ ...admitted, sha256: typeof admitted.sha256 }, { decision: 'admitted', template: 'question', subject: '4', sha256: 'string', reason: null });
  const typed = decideAsk({ asked: { ...AS_RENDERED, question: 'Pregunta 4: ¿Seguimos?' }, questions: [RECORDED], recordPath: CHANNEL });
  assert.equal(typed.decision, 'refused');
  assert.equal(typed.subject, '4');
  assert.match(typed.reason, /its text is not question 4's as recorded; the record is \/h\/\.js-harness\/channel\/p\.jsonl/);
  assert.match(typed.reason, /js-harness notify --to orchestrator --kind question, then ask it with the input js-harness template ask 4 prints, unchanged\./);
  const unnumbered = decideAsk({ asked: { question: '¿Seguimos?', options: [] }, questions: [RECORDED], recordPath: CHANNEL });
  assert.equal(unnumbered.subject, null);
  assert.match(unnumbered.reason, /template ask <n> prints/);
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
    decideAsk({ asked: { question: '¿Seguimos?', options: [] }, questions: [], recordPath: CHANNEL }).reason,
    decideAsk({ asked: { question: 'Pregunta 4: ¿Seguimos?', options: [] }, questions: [], recordPath: CHANNEL }).reason,
    decideSummary({ changes: [{ action: 'delete' }], previous: ['a', 'b'] }).reason,
    decideSummary({ changes: [{ action: 'str_replace', field: 'yours' }], previous: ['a'] }).reason,
  ];
  for (const reason of reasons) assert.match(reason, whole);
  assert.deepEqual(cutSpans(GATE_MESSAGES).map((span) => span.text.trim()), Object.values(GATE_SAYS));
});

test('shownReport counts each template\'s decisions, lists free pages and names a moment nothing was shown for', () => {
  const line = (decision, extra = {}) => ({ at: hoursAgo(1), decision, template: 'stretch-return', subject: 's-7', reason: null, ...extra });
  const report = shownReport({
    rendered: [rendered(PAGE)],
    shown: [line('refused'), line('admitted'), line('shown'), line('free', { template: null, subject: null, reason: 'a research page for him' }), line('unchecked', { template: null, subject: null })],
    moments: [{ template: 'stretch-return', subject: 's-7' }, { template: 'stretch-return', subject: 's-8' }],
  });
  assert.deepEqual(report.templates, { 'stretch-return': { rendered: 1, admitted: 1, shown: 1, refused: 1, unchecked: 0 } });
  assert.deepEqual(report.free, [{ at: hoursAgo(1), reason: 'a research page for him' }]);
  assert.deepEqual(report.escapes, ['the moment s-8 of stretch-return was never shown']);
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
