import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engramAsset, planUpgrade } from './stack-upgrade.mjs';

const ON = { codeMap: { value: 'auto' }, codexReview: { value: 'on' } };
const PNPM = { words: ['pnpm'], kind: 'pnpm' };
const NPM = { words: ['npm'], kind: 'npm' };

/** A probed row of `id`, installed at `version`. */
const row = (id, version, cells = {}) => ({ id, version, installed: 'ok', ...cells });

function rows(versions = {}) {
  const at = { engram: '3.6.2', 'engram-plugin': '0.1.19', codegraph: '1.6.2', context7: 'hosted', codex: '0.167.0', ...versions };
  return Object.entries(at).map(([id, version]) => (version === null ? row(id, 'missing', { installed: 'missing' }) : row(id, version)));
}

const LATEST = { engram: '3.6.2', 'engram-plugin': '0.1.19', codegraph: '1.6.2', codex: '0.167.0' };
const plan = (versions, latest = {}, extra = {}) => planUpgrade({ rows: rows(versions), latest: { ...LATEST, ...latest }, functions: ON, pm: PNPM, platform: 'win32', arch: 'x64', ...extra });

test('a stack at its latest versions plans no update, and says each tool is current, context7 as hosted', () => {
  const p = plan();
  assert.deepEqual(p.updates, []);
  assert.deepEqual(p.current, [
    { tool: 'engram', version: '3.6.2' },
    { tool: 'engram-plugin', version: '0.1.19' },
    { tool: 'codegraph', version: '1.6.2' },
    { tool: 'codex', version: '0.167.0' },
    { tool: 'context7', version: 'hosted' },
  ]);
  assert.deepEqual(p.unknown, []);
});

test('an outdated package is updated by its package manager to the latest version, and its undo installs the one before', () => {
  const p = plan({ codegraph: '1.6.0' }, { codegraph: '1.7.0' });
  assert.deepEqual(p.updates, [{
    tool: 'codegraph', dimension: 'upToDate', kind: 'package', bin: 'codegraph', from: '1.6.0', to: '1.7.0',
    run: ['pnpm', 'add', '-g', '@colbymchenry/codegraph@1.7.0'], undo: ['pnpm', 'add', '-g', '@colbymchenry/codegraph@1.6.0'], env: {},
  }]);
});

test('npm installs with its own verb, and under a prefix the install and its undo get the prefix', () => {
  const p = plan({ codex: '0.160.0' }, { codex: '0.167.0' }, { pm: NPM, prefix: 'C:\\p' });
  assert.deepEqual(p.updates[0].run, ['npm', 'install', '-g', '@openai/codex@0.167.0', '--prefix', 'C:\\p']);
  assert.deepEqual(p.updates[0].undo, ['npm', 'install', '-g', '@openai/codex@0.160.0', '--prefix', 'C:\\p']);
  assert.equal(p.updates[0].env.PATH, 'C:\\p', 'the prefix goes first on the PATH, so the probe finds the copy it installed');
});

test('a second update of the same tool keeps the first version before as its undo', () => {
  const records = [{ tool: 'codegraph', dimension: 'upToDate', kind: 'package', from: '1.5.0', undo: ['pnpm', 'add', '-g', '@colbymchenry/codegraph@1.5.0'] }];
  const p = plan({ codegraph: '1.6.0' }, { codegraph: '1.7.0' }, { records });
  assert.equal(p.updates[0].from, '1.5.0');
  assert.deepEqual(p.updates[0].undo, ['pnpm', 'add', '-g', '@colbymchenry/codegraph@1.5.0']);
});

test('the engram binary is updated from its release first, and the plugin after it, whose latest follows the binary', () => {
  const p = plan({ engram: '3.6.1', codegraph: '1.6.0' }, { engram: '3.6.2', codegraph: '1.7.0', 'engram-plugin': '0.1.19' });
  assert.deepEqual(p.updates.map((u) => u.tool), ['engram', 'engram-plugin', 'codegraph']);
  const [engram, plugin] = p.updates;
  assert.deepEqual(engram, {
    tool: 'engram', dimension: 'upToDate', kind: 'binary', bin: 'engram', from: '3.6.1', to: '3.6.2',
    asset: 'engram_3.6.2_windows_amd64.zip',
    release: 'https://github.com/Gentleman-Programming/engram/releases/download/v3.6.2',
  });
  assert.deepEqual(plugin, {
    tool: 'engram-plugin', dimension: 'upToDate', kind: 'plugin', from: '0.1.19', to: null,
    run: [['claude', 'plugin', 'marketplace', 'update', 'engram'], ['claude', 'plugin', 'update', 'engram@engram']],
    undo: null,
  });
});

test('the plugin alone behind its latest is updated to it', () => {
  const p = plan({ 'engram-plugin': '0.1.14' }, { 'engram-plugin': '0.1.19' });
  assert.deepEqual(p.updates.map((u) => [u.tool, u.from, u.to]), [['engram-plugin', '0.1.14', '0.1.19']]);
});

test('a latest version that is not known plans nothing for that tool and says so', () => {
  const p = plan({}, { codegraph: null, 'engram-plugin': null });
  assert.deepEqual(p.updates, []);
  assert.deepEqual(p.unknown.map((u) => u.tool), ['engram-plugin', 'codegraph']);
  assert.match(p.unknown[0].why, /latest version is not known/);
});

test('a tool that is not installed is no update: stack install installs it', () => {
  const p = plan({ codegraph: null }, { codegraph: '1.7.0' });
  assert.deepEqual(p.updates, []);
  assert.equal(p.current.some((c) => c.tool === 'codegraph'), false);
});

test('a tool its switch turns off is never updated', () => {
  const p = planUpgrade({ rows: rows({ codegraph: '1.6.0' }), latest: { ...LATEST, codegraph: '1.7.0' }, functions: { ...ON, codeMap: { value: 'off' } }, pm: PNPM, platform: 'linux', arch: 'x64' });
  assert.deepEqual(p.updates, []);
});

test('engram\'s release asset is named for the platform and the processor', () => {
  assert.equal(engramAsset('3.6.2', 'win32', 'x64'), 'engram_3.6.2_windows_amd64.zip');
  assert.equal(engramAsset('3.6.2', 'win32', 'arm64'), 'engram_3.6.2_windows_arm64.zip');
  assert.equal(engramAsset('3.6.2', 'linux', 'x64'), 'engram_3.6.2_linux_amd64.tar.gz');
  assert.equal(engramAsset('3.6.2', 'darwin', 'arm64'), 'engram_3.6.2_darwin_arm64.tar.gz');
  assert.equal(engramAsset('3.6.2', 'freebsd', 'x64'), null);
  assert.equal(engramAsset('3.6.2', 'linux', 'ia32'), null);
});

test('engram on a platform with no release is not known, never guessed', () => {
  const p = plan({ engram: '3.6.1' }, { engram: '3.6.2' }, { platform: 'freebsd' });
  assert.deepEqual(p.updates.map((u) => u.tool), []);
  assert.match(p.unknown.find((u) => u.tool === 'engram').why, /no release for freebsd/);
});

test('an earlier update recorded under another prefix lends no undo: the tool is held until uninstall undoes that one (Codex P2)', () => {
  const earlier = { tool: 'codegraph', dimension: 'upToDate', kind: 'package', from: '1.5.0', to: '1.6.0', prefix: 'C:\a', undo: ['pnpm', 'add', '-g', '@colbymchenry/codegraph@1.5.0'] };
  const p = plan({ codegraph: '1.6.0' }, { codegraph: '1.7.0' }, { prefix: 'C:\b', records: [earlier] });
  assert.deepEqual(p.updates, []);
  assert.deepEqual(p.held, [{ tool: 'codegraph', why: 'an earlier upgrade of it is recorded under the prefix C:\a, not C:\b: js-harness uninstall machine undoes that one first' }]);
  const same = plan({ codegraph: '1.6.0' }, { codegraph: '1.7.0' }, { prefix: 'C:\a', records: [earlier] });
  assert.equal(same.updates[0].from, '1.5.0', 'under the same prefix the first version before stays the undo');
  assert.deepEqual(same.held, []);
});
