import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, areaOf, bucket, draftRelease, lastRead, parseNumstat, stableVersions, unreadVersions } from './idea-watch.mjs';

// One changed path a row of AREAS, in the order of the table, and one no row matches: the diet's S9 probe
// (docs/proposals/harness-diet.md:802).
const ONE_A_ROW = {
  workflow: 'internal/assets/claude/orchestrator.md',
  review: 'internal/reviewtransaction/transaction.go',
  voice: 'internal/assets/claude/output-style-neutral.md',
  skills: 'internal/assets/skills/branch-pr/SKILL.md',
  lenses: 'internal/assets/claude/agents/review-risk.md',
  permissions: 'internal/components/permissions/inject.go',
  mcp: 'internal/components/mcp/context7.go',
  complements: 'internal/components/engram/setup.go',
  tui: 'internal/tui/model.go',
  install: 'internal/backup/snapshot.go',
  hosts: 'internal/agents/claude/adapter.go',
  models: 'internal/model/presets.go',
  ignore: 'internal/shellinstaller/run.go',
};
const UNMATCHED = 'internal/brandnew/thing.go';

const numstat = (rows) => rows.map(([added, deleted, file]) => `${added}\t${deleted}\t${file}`).join('\0');

test('every row of AREAS has a fixture path, so the probe covers the whole table', () => {
  assert.deepEqual(AREAS.map((area) => area.id), Object.keys(ONE_A_ROW));
});

test('each fixture path lands in its own row, and a path no row matches is null', () => {
  for (const [id, file] of Object.entries(ONE_A_ROW)) assert.equal(areaOf(file), id, file);
  assert.equal(areaOf(UNMATCHED), null);
});

test('the first row that matches wins: a shared odd skill is workflow, Claude\'s adapter is hosts, another host is ignore', () => {
  assert.equal(areaOf('internal/assets/skills/_shared/odd-contract.md'), 'workflow');
  assert.equal(areaOf('internal/agents/capability_manifest.go'), 'hosts');
  assert.equal(areaOf('internal/agents/copilotcli/adapter.go'), 'ignore');
  assert.equal(areaOf('internal/assets/codex/orchestrator.md'), 'workflow');
  assert.equal(areaOf('internal/assets/gga/AGENTS.md'), 'ignore');
});

test('a single star stays inside one folder and a double star crosses any number of them', () => {
  assert.equal(areaOf('internal/agents/claude/deep/nested/file.go'), 'hosts');
  assert.equal(areaOf('internal/assets/claude/sub/orchestrator.md'), null);
  assert.equal(areaOf('README.md'), 'ignore');
  assert.equal(areaOf('docs/README.md'), 'ignore');
  assert.equal(areaOf('src/README.md'), null);
});

test('the numstat parser reads NUL- or newline-separated rows, and a binary file counts no lines', () => {
  assert.deepEqual(parseNumstat('3\t1\ta.go\0-\t-\tlogo.png\0'), [
    { file: 'a.go', added: 3, deleted: 1 },
    { file: 'logo.png', added: null, deleted: null },
  ]);
  assert.deepEqual(parseNumstat('2\t0\tx.md\r\n'), [{ file: 'x.md', added: 2, deleted: 0 }]);
  assert.deepEqual(parseNumstat(''), []);
});

test('NUL-separated numstat keeps a line break inside a path, since -z prints the path as it is', () => {
  assert.deepEqual(parseNumstat('1\t0\tdocs/odd\nname.md\x002\t2\tb.go\0'), [
    { file: 'docs/odd\nname.md', added: 1, deleted: 0 },
    { file: 'b.go', added: 2, deleted: 2 },
  ]);
});

test('the diet\'s probe: each path in its area, the unmatched one kept apart for hand classification', () => {
  const changes = parseNumstat(numstat([...Object.values(ONE_A_ROW).map((file) => [1, 1, file]), [4, 2, UNMATCHED]]));
  const { areas, unmatched } = bucket(changes);
  assert.deepEqual(areas.map((area) => [area.id, area.changes.map((change) => change.file)]), Object.entries(ONE_A_ROW).map(([id, file]) => [id, [file]]));
  assert.deepEqual(unmatched.map((change) => change.file), [UNMATCHED]);

  const draft = draftRelease({ from: '4.3.1', to: '4.4.0', changes, date: '2026-11-05' });
  assert.match(draft, /^### v4\.4\.0 \(from v4\.3\.1, read 2026-11-05\)$/m);
  // One row an area, its verdict undecided but in the ignored area, which is decided.
  for (const id of Object.keys(ONE_A_ROW).filter((id) => id !== 'ignore')) assert.match(draft, new RegExp(`^\\| ${id} \\|.*\\| 1 \\| \\+1 -1 \\| \\? \\|`, 'm'), id);
  assert.match(draft, /^\| ignore \|.*\| 1 \| \+1 -1 \| ignore \| an ignored area \|$/m);
  assert.match(draft, /^To classify by hand:\n- `internal\/brandnew\/thing\.go` \(\+4 -2\)$/m);
  // Every changed path is named under its area, so the reader never runs the diff again to find it.
  for (const [id, file] of Object.entries(ONE_A_ROW)) assert.ok(draft.includes(`- ${id}: \`${file}\` (+1 -1)`), id);
});

test('an ignore-only release drafts one batched line, not a section', () => {
  const changes = parseNumstat(numstat([[10, 2, 'e2e/run_test.go'], [1, 1, 'internal/shellinstaller/a.go'], ['-', '-', 'docs/logo.png']]));
  assert.equal(draftRelease({ from: '4.3.1', to: '4.3.2', changes, date: '2026-11-05' }),
    '- v4.3.2 (from v4.3.1, read 2026-11-05): ignore; 3 paths, all in ignored areas, +11 -3');
});

test('a release whose only change matches no row is a section, never a batched ignore', () => {
  const draft = draftRelease({ from: '4.3.1', to: '4.3.2', changes: parseNumstat('1\t0\tnew/place.go'), date: '2026-11-05' });
  assert.match(draft, /^### v4\.3\.2/);
  assert.match(draft, /^- `new\/place\.go` \(\+1 -0\)$/m);
});

test('a release that changed nothing is still one batched line, so it is read', () => {
  assert.equal(draftRelease({ from: '4.3.1', to: '4.3.2', changes: [], date: '2026-11-05' }),
    '- v4.3.2 (from v4.3.1, read 2026-11-05): ignore; 0 paths, all in ignored areas, +0 -0');
});

const LS_REMOTE = [
  'aaa\trefs/tags/advisory',
  'bbb\trefs/tags/v4.2.0',
  'ccc\trefs/tags/v4.10.0',
  'ddd\trefs/tags/v4.3.1',
  'eee\trefs/tags/v4.3.1^{}',
  'fff\trefs/tags/v4.4.0-rc.1',
  'ggg\trefs/tags/v4.3.0',
  'hhh\trefs/heads/main',
].join('\n');

test('the stable versions of ls-remote: plain v<semver> tags only, each once, in semver order', () => {
  assert.deepEqual(stableVersions(LS_REMOTE), ['4.2.0', '4.3.0', '4.3.1', '4.10.0']);
});

test('the releases not yet read are the stable ones above the last read, oldest first', () => {
  assert.deepEqual(unreadVersions(['4.2.0', '4.3.0', '4.3.1', '4.10.0'], '4.3.0'), ['4.3.1', '4.10.0']);
  assert.deepEqual(unreadVersions(['4.3.1'], '4.3.1'), []);
  assert.deepEqual(unreadVersions(['4.3.1'], null), ['4.3.1']);
});

const RECORD = `# gentle-ai update check

## Log
- L1. v9.9.9 is named here and is no read.

## Releases read
- v4.3.1 (read 2026-10-28): the full review, section 13.
- v4.3.2 (from v4.3.1, read 2026-11-05): ignore; 3 paths, all in ignored areas, +11 -3

### v4.4.0 (from v4.3.2, read 2026-11-06)

| Area | What we look for | Paths | Lines | Verdict | Evidence |
|---|---|---|---|---|---|
| workflow | workflow ideas | 1 | +1 -1 | adapt | \`internal/assets/claude/orchestrator.md:10-20\` |

To classify by hand:
(none)
`;

test('the last version read is the highest release of the record\'s own section, decided whole', () => {
  assert.equal(lastRead(RECORD), '4.4.0');
  assert.equal(lastRead('# nothing yet\n'), null);
  assert.equal(lastRead('## Releases read\n- v4.3.1 (read 2026-10-28): the full review.\n'), '4.3.1');
});

test('a drafted section with a verdict still "?" or a path left to classify does not count as read', () => {
  const undecided = RECORD.replace('| adapt |', '| ? |');
  assert.equal(lastRead(undecided), '4.3.2');
  const handList = RECORD.replace('(none)', '- `new/place.go` (+1 -0)');
  assert.equal(lastRead(handList), '4.3.2');
  // The draft itself, pasted as it is printed, is not read until it is decided.
  const draft = draftRelease({ from: '4.3.2', to: '4.5.0', changes: parseNumstat('1\t1\tinternal/tui/model.go'), date: '2026-11-07' });
  assert.equal(lastRead(`${RECORD}\n${draft}\n`), '4.4.0');
});

test('a verdict counts only as adopt, adapt or ignore with its evidence: a cleared or empty cell is not read', () => {
  assert.equal(lastRead(RECORD.replace('| adapt |', '|  |')), '4.3.2', 'an emptied verdict');
  assert.equal(lastRead(RECORD.replace('| adapt |', '| maybe |')), '4.3.2', 'a word that is no verdict');
  assert.equal(lastRead(RECORD.replace(/\| `internal[^|]*\|$/m, '|  |')), '4.3.2', 'a verdict with no evidence');
  assert.equal(lastRead(RECORD.replace('| adapt |', '| Adopt |')), '4.4.0', 'the verdict read in any case');
});

test('a path left to classify counts after a blank line too: the whole hand list is read, up to the paths by area', () => {
  const spaced = RECORD.replace('To classify by hand:\n(none)', 'To classify by hand:\n\n- `new/place.go` (+1 -0)\n\nPaths by area:\n- workflow: `a.md` (+1 -1)');
  assert.equal(lastRead(spaced), '4.3.2');
  const cleared = RECORD.replace('To classify by hand:\n(none)', 'To classify by hand:\n\n(none)\n\nPaths by area:\n- workflow: `a.md` (+1 -1)');
  assert.equal(lastRead(cleared), '4.4.0', 'the paths by area are no path left to classify');
});
