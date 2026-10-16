// The stack-update row of `doctor` (docs/FAILURES.md, cli-updated-itself): a tool of the stack whose version moved
// since the versions last reviewed is a gap until `doctor --stack-reviewed` records the review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackNotice, stackUpdateRow, stackVersions } from './stack-update.mjs';

const AT = '2026-10-16T00:00:00.000Z';
const now = () => new Date(AT);

test('the versions read are those of the tools installed, with the Claude CLI on PATH, and without gentle-ai, which has its own row', () => {
  const rows = [
    { id: 'gentle-ai', installed: 'ok', version: '3.7.0' },
    { id: 'engram', installed: 'ok', version: '3.3.0' },
    { id: 'codex', installed: 'missing', version: null },
    { id: 'context7', installed: 'ok', version: 'hosted' },
    { id: 'memory-rules', installed: 'n/a', version: null },
  ];
  assert.deepEqual(stackVersions(rows, '2.1.296'), { claude: '2.1.296', engram: '3.3.0' });
  assert.deepEqual(stackVersions(rows, null), { engram: '3.3.0' });
});

test('the first reading is recorded as reviewed, and the row says how many tools it watches', () => {
  const { row, record } = stackUpdateRow({ claude: '2.1.296', engram: '3.3.0' }, null, now);
  assert.equal(row.installed, 'ok');
  assert.equal(row.version, '2 tools');
  assert.deepEqual(record, { versions: { claude: '2.1.296', engram: '3.3.0' }, at: AT });
});

test('a tool updated by itself since the review is stale, with its versions and the review steps, and the record stays', () => {
  const reviewed = { versions: { claude: '2.1.290', codegraph: '1.0.0', engram: '3.2.0' }, at: '2026-10-09T00:00:00.000Z' };
  const { row, record } = stackUpdateRow({ claude: '2.1.296', codegraph: '1.0.0', engram: '3.3.0' }, reviewed, now);
  assert.equal(row.installed, 'stale');
  assert.equal(row.change, 'claude 2.1.290 → 2.1.296, engram 3.2.0 → 3.3.0');
  assert.deepEqual(row.fix.installed, [
    'claude 2.1.290 → 2.1.296, engram 3.2.0 → 3.3.0 since the last review; review the update:',
    'read the changelog of each tool between those versions',
    'check that the hooks and commands of the harness that run them still work',
    'say it to the user, and to whoever plans a measurement on the versions before',
    'then record the review: js-harness doctor --stack-reviewed',
  ]);
  assert.equal(record, null);
  assert.equal(stackNotice(row), 'claude 2.1.290 → 2.1.296, engram 3.2.0 → 3.3.0 since the last review');
});

test('a tool installed since the review joins the record as it is, and a tool gone is no change', () => {
  const reviewed = { versions: { engram: '3.3.0', codex: '0.160.1' }, at: '2026-10-09T00:00:00.000Z' };
  const { row, record } = stackUpdateRow({ engram: '3.3.0', codegraph: '1.0.0' }, reviewed, now);
  assert.equal(row.installed, 'ok');
  assert.deepEqual(record, { versions: { engram: '3.3.0', codex: '0.160.1', codegraph: '1.0.0' }, at: '2026-10-09T00:00:00.000Z' });
  assert.equal(stackNotice(row), '');
});

test('nothing read is no row of its own state and no record', () => {
  const { row, record } = stackUpdateRow({}, null, now);
  assert.equal(row.installed, 'n/a');
  assert.equal(record, null);
});
