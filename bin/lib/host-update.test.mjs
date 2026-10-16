import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hostUpdateRow, readHostVersions } from './host-update.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-host-update-'));

/** An app folder as Claude Desktop leaves it: the sentry scope with the running version, the config with the staged
 * update (and a token, which nothing may read), and one folder per bundled Code tab CLI. */
function seedApp(dir, { running = '2.37337.1', staged = '2.42304.0', clis = ['2.1.293', '2.1.295'] } = {}) {
  fs.mkdirSync(path.join(dir, 'sentry'), { recursive: true });
  if (running !== null) fs.writeFileSync(path.join(dir, 'sentry', 'scope_v3.json'), JSON.stringify({ scope: { contexts: { app: { app_name: 'Claude', app_version: running } } } }));
  const config = { updaterLastSeenVersion: running, 'oauth:tokenCacheV2': 'secret-token' };
  if (staged !== null) config.updaterStagedPayloadKind = { version: staged, kind: null, arch: 'x64' };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  for (const cli of clis) fs.mkdirSync(path.join(dir, 'claude-code', cli), { recursive: true });
  fs.mkdirSync(path.join(dir, 'claude-code', 'not-a-version'), { recursive: true });
}

test('the versions are read from the MSIX package folder before %APPDATA%: the running one, the staged one and the highest Code tab CLI', () => {
  const local = tmp();
  const roaming = tmp();
  try {
    seedApp(path.join(local, 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude'), { clis: ['2.1.293', '2.1.295', '2.1.40'] });
    seedApp(path.join(roaming, 'Claude'), { running: '1.0.0', staged: null, clis: ['1.0.0'] });
    const versions = readHostVersions({ platform: 'win32', env: { LOCALAPPDATA: local, APPDATA: roaming }, home: tmp() });
    assert.deepEqual(versions, { found: true, desktop: '2.37337.1', staged: '2.42304.0', code: '2.1.295' });
    assert.doesNotMatch(JSON.stringify(versions), /secret-token/);
  } finally {
    for (const dir of [local, roaming]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('with no package folder %APPDATA%\\Claude is read; macOS and Linux read their own app folders', () => {
  const roaming = tmp();
  const home = tmp();
  try {
    seedApp(path.join(roaming, 'Claude'), { staged: null });
    assert.deepEqual(readHostVersions({ platform: 'win32', env: { LOCALAPPDATA: tmp(), APPDATA: roaming }, home }), { found: true, desktop: '2.37337.1', staged: null, code: '2.1.295' });
    seedApp(path.join(home, 'Library', 'Application Support', 'Claude'), { running: '2.1.0', staged: null, clis: [] });
    assert.deepEqual(readHostVersions({ platform: 'darwin', env: {}, home }), { found: true, desktop: '2.1.0', staged: null, code: null });
    seedApp(path.join(home, '.config', 'Claude'), { running: '2.2.0', staged: '2.3.0', clis: ['2.1.1'] });
    assert.deepEqual(readHostVersions({ platform: 'linux', env: {}, home }), { found: true, desktop: '2.2.0', staged: '2.3.0', code: '2.1.1' });
  } finally {
    for (const dir of [roaming, home]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no app folder is not found; a folder whose files are missing or broken reads as unknown versions, never a throw', () => {
  const roaming = tmp();
  try {
    assert.deepEqual(readHostVersions({ platform: 'win32', env: { APPDATA: roaming }, home: tmp() }), { found: false, desktop: null, staged: null, code: null });
    fs.mkdirSync(path.join(roaming, 'Claude', 'sentry'), { recursive: true });
    fs.writeFileSync(path.join(roaming, 'Claude', 'sentry', 'scope_v3.json'), '{ not json');
    fs.writeFileSync(path.join(roaming, 'Claude', 'config.json'), JSON.stringify({ updaterStagedPayloadKind: { version: 42 } }));
    assert.deepEqual(readHostVersions({ platform: 'win32', env: { APPDATA: roaming }, home: tmp() }), { found: true, desktop: null, staged: null, code: null });
  } finally {
    fs.rmSync(roaming, { recursive: true, force: true });
  }
});

const current = { found: true, desktop: '2.42304.0', staged: null, code: '2.1.299' };
const reviewed = { desktop: '2.37337.1', code: '2.1.295', at: '2026-10-15T00:00:00.000Z' };
const NOW = () => new Date('2026-10-15T23:00:00.000Z');

test('the first reading with no record is taken as reviewed: the row is ok and the record to write holds what was read', () => {
  const { row, record } = hostUpdateRow(current, null, NOW);
  assert.deepEqual(row, { id: 'host-update', version: '2.42304.0', installed: 'ok', claude: 'ok', codex: 'n/a', project: 'n/a', upToDate: 'ok', fix: {} });
  assert.deepEqual(record, { desktop: '2.42304.0', code: '2.1.299', at: '2026-10-15T23:00:00.000Z' });
});

test('an update since the reviewed versions is stale until reviewed: its fix names the old and new versions and every review step, and nothing is recorded', () => {
  const { row, record } = hostUpdateRow(current, reviewed, NOW);
  assert.equal(record, null);
  assert.equal(row.claude, 'stale');
  assert.equal(row.upToDate, 'ok');
  assert.equal(row.change, 'Claude Desktop 2.37337.1 → 2.42304.0 and its Code tab CLI 2.1.295 → 2.1.299');
  assert.deepEqual(row.fix.claude, [
    'Claude Desktop 2.37337.1 → 2.42304.0 and its Code tab CLI 2.1.295 → 2.1.299 since the last review; review the update:',
    'read https://claude.com/docs/cowork/claude-desktop-changelog from 2.37337.1 to 2.42304.0',
    'read the Claude Code CHANGELOG (https://code.claude.com/docs/en/changelog) from 2.1.295 to 2.1.299',
    'check that the harness hooks in ~/.claude/settings.json still run',
    'check Remote Control in each session',
    'report the benefits, the behavior changes and the breaking changes to the user',
    'then record the review: js-harness doctor --host-reviewed',
  ]);
});

test('a Code tab CLI update alone names only the CLI and its changelog', () => {
  const { row } = hostUpdateRow({ ...current, desktop: '2.37337.1' }, reviewed, NOW);
  assert.equal(row.claude, 'stale');
  assert.equal(row.change, 'the Code tab CLI 2.1.295 → 2.1.299');
  assert.equal(row.fix.claude[0], 'the Code tab CLI 2.1.295 → 2.1.299 since the last review; review the update:');
  assert.ok(!row.fix.claude.some((line) => line.includes('claude-desktop-changelog')));
  assert.ok(row.fix.claude.some((line) => line.startsWith('read the Claude Code CHANGELOG')));
});

test('a reviewed record with no CLI version takes the CLI read now as its baseline, so a later CLI update is seen (Codex, 2026-10-15)', () => {
  const noCli = { desktop: '2.37337.1', code: null, at: '2026-10-15T00:00:00.000Z' };
  const filled = hostUpdateRow({ found: true, desktop: '2.37337.1', staged: null, code: '2.1.295' }, noCli, NOW);
  assert.equal(filled.row.claude, 'ok');
  assert.deepEqual(filled.record, { desktop: '2.37337.1', code: '2.1.295', at: '2026-10-15T23:00:00.000Z' });
  assert.equal(hostUpdateRow({ found: true, desktop: '2.37337.1', staged: null, code: '2.1.299' }, filled.record, NOW).row.change, 'the Code tab CLI 2.1.295 → 2.1.299');
  const desktopToo = hostUpdateRow(current, noCli, NOW);
  assert.equal(desktopToo.row.claude, 'stale', 'a desktop update is still due its review');
  assert.equal(desktopToo.record, null, 'and its review records the CLI with it');
});

test('a staged version newer than the running one is outdated: downloaded and not applied, with the quit as its fix', () => {
  const { row } = hostUpdateRow({ found: true, desktop: '2.37337.1', staged: '2.42304.0', code: '2.1.295' }, reviewed, NOW);
  assert.equal(row.claude, 'ok');
  assert.equal(row.upToDate, 'outdated');
  assert.equal(row.staged, '2.42304.0');
  assert.equal(row.fix.upToDate, 'Claude Desktop 2.42304.0 is downloaded and not applied (running 2.37337.1): quit Claude fully, the tray icon included, and open it again');
  assert.equal(hostUpdateRow({ ...current, staged: '2.42304.0' }, { ...reviewed, desktop: '2.42304.0', code: '2.1.299' }, NOW).row.upToDate, 'ok', 'a staged version that is running is applied');
});

test('no app folder is n/a in every cell; an unreadable running version is unknown, no gap, and records nothing', () => {
  assert.deepEqual(hostUpdateRow({ found: false, desktop: null, staged: null, code: null }, null, NOW), {
    row: { id: 'host-update', version: null, installed: 'n/a', claude: 'n/a', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} },
    record: null,
  });
  assert.deepEqual(hostUpdateRow({ found: true, desktop: null, staged: '2.42304.0', code: '2.1.295' }, null, NOW), {
    row: { id: 'host-update', version: null, installed: 'unknown', claude: 'unknown', codex: 'n/a', project: 'n/a', upToDate: 'unknown', fix: {} },
    record: null,
  });
});
