// The summary a finished session leaves (odd/tasks/session-close.md, T1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryMain } from './summary.mjs';
import { SUMMARY_HEADINGS, summaryPath, summaryProblems, summaryTemplate } from './lib/summary.mjs';
import { openingFileName, titleSlug } from './lib/channel.mjs';

const NOW = () => Date.parse('2026-10-17T09:30:00Z');

function call(argv) {
  const out = [];
  const err = [];
  const code = summaryMain(argv, { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: NOW });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('template prints the summary of the titled session: its title, its file and every heading in order', () => {
  const { code, out, err } = call(['template', '--title', 'JH 24 · gate más rápido']);
  assert.equal(code, 0, err);
  const lines = out.split('\n');
  assert.equal(lines[0], '# JH 24 · gate más rápido');
  assert.match(out, /docs\/sessions\/2026-10-17-jh-24-gate-mas-rapido\.md/);
  const headings = lines.filter((line) => line.startsWith('## ')).map((line) => line.slice(3));
  assert.deepEqual(headings, SUMMARY_HEADINGS);
});

test('path prints only the file of the titled session, dated today in UTC', () => {
  const { code, out } = call(['path', '--title', 'JH 24 · gate más rápido']);
  assert.equal(code, 0);
  assert.equal(out, 'docs/sessions/2026-10-17-jh-24-gate-mas-rapido.md');
});

test('a bad command line is a usage error, exit 2, and prints nothing on standard output', () => {
  for (const argv of [[], ['nope'], ['template'], ['path', '--title'], ['template', '--title', '·· ··'], ['template', '--title', 'a', '--x']]) {
    const { code, out, err } = call(argv);
    assert.equal(code, 2, JSON.stringify(argv));
    assert.equal(out, '', JSON.stringify(argv));
    assert.match(err, /Usage: js-harness summary/, JSON.stringify(argv));
  }
});

test('the title slug is the readable part of the opening file name, so one title gives one name', () => {
  for (const title of ['JH 24 · gate más rápido', 'JH ORQ · js-harness (350k)', 'Ñandú: CON?']) {
    assert.ok(openingFileName(title).startsWith(`${titleSlug(title)}-`), title);
  }
  assert.equal(summaryPath('JH 24 · gate más rápido', NOW()), 'docs/sessions/2026-10-17-jh-24-gate-mas-rapido.md');
});

test('the bare template has every section empty, a filled one has no problem, and a missing heading is named', () => {
  const bare = summaryTemplate('JH 24', NOW());
  assert.deepEqual(summaryProblems(bare), SUMMARY_HEADINGS.map((heading) => `"${heading}" is empty`));
  const filled = bare.replace(/^<.*>$/gm, '- a fact, with its evidence (#379).');
  assert.deepEqual(summaryProblems(filled), []);
  const missing = filled.replace('## Cost\n', '');
  assert.deepEqual(summaryProblems(missing), ['"Cost" is missing']);
});
