// The product loads none of the workshop (odd/tasks/workshop-product-split.md, finding 15). The workshop never ships
// (package.json's "files" names only bin/), so a product command that reached a module under workshop/ would fail in
// every installed copy and pass in this checkout. A static import check reads the source; this reads what a run
// loads: a child `node` started with a resolve hook (`module.registerHooks`) writes each module URL it resolves, and
// the commands a session meets on every turn and gate, `check`, `doctor --hook` and `loop status`, load none there.
// Each runs from a scratch repository with every home pointed at a scratch folder, so nothing on this machine is read
// or written; what a command prints or exits does not matter here, only what it loaded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(import.meta.dirname, '..');
const WORKSHOP = `${pathToFileURL(path.join(REPO, 'workshop')).href}/`;

// The hook the child is started with: each URL it resolves, a line of the log its environment names.
const HOOK = [
  "import { registerHooks } from 'node:module';",
  "import { appendFileSync } from 'node:fs';",
  'registerHooks({',
  '  resolve(specifier, context, nextResolve) {',
  '    const resolved = nextResolve(specifier, context);',
  '    appendFileSync(process.env.LOAD_LOG, resolved.url + "\\n");',
  '    return resolved;',
  '  },',
  '});',
  '',
].join('\n');

/** The module URLs `entry` with `args` loads, run from a scratch repository with one empty commit. */
function loaded(entry, args) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-load-'));
  try {
    const home = path.join(root, 'home');
    const cwd = path.join(root, 'repo');
    fs.mkdirSync(home);
    fs.mkdirSync(cwd);
    const hook = path.join(root, 'hook.mjs');
    fs.writeFileSync(hook, HOOK);
    const log = path.join(root, 'loaded.txt');
    fs.writeFileSync(log, '');
    const env = { ...process.env, JS_HARNESS_HOME: home, CLAUDE_CONFIG_DIR: home, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, TEMP: home, TMP: home, TMPDIR: home, JS_HARNESS_CHECK_INNER: '1', LOAD_LOG: log };
    for (const key of Object.keys(env)) {
      if (key.startsWith('GIT_') || key === 'JS_HARNESS_SOURCE' || key === 'JS_HARNESS_PREFIX' || key === 'CLAUDE_CODE_SESSION_ID') delete env[key];
    }
    env.GIT_CEILING_DIRECTORIES = root;
    env.GIT_CONFIG_NOSYSTEM = '1';
    env.GIT_CONFIG_GLOBAL = path.join(root, 'empty.gitconfig');
    fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '');
    const git = (...gitArgs) => spawnSync('git', ['-c', 'user.name=load', '-c', 'user.email=load@example.invalid', ...gitArgs], { cwd, env });
    assert.equal(git('init', '-q').status, 0);
    assert.equal(git('commit', '-q', '--allow-empty', '-m', 'empty').status, 0);
    spawnSync(process.execPath, ['--import', pathToFileURL(hook).href, entry, ...args], { cwd, env, encoding: 'utf8', input: '', timeout: 120000 });
    return [...new Set(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean))];
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const PRODUCT = path.join(REPO, 'bin', 'js-harness.mjs');
const RUNS = [
  { args: ['check', '--door', '--base', 'HEAD'], module: 'bin/check.mjs' },
  { args: ['doctor', '--hook'], module: 'bin/doctor.mjs' },
  { args: ['loop', 'status'], module: 'bin/loop.mjs' },
];

for (const { args, module } of RUNS) {
  test(`js-harness ${args.join(' ')} loads no module of the workshop`, () => {
    const urls = loaded(PRODUCT, args);
    assert.ok(urls.includes(pathToFileURL(path.join(REPO, module)).href), `the run never loaded ${module}, so it proves nothing`);
    assert.deepEqual(urls.filter((url) => url.startsWith(WORKSHOP)), []);
  });
}

test('the hook sees a module of the workshop where one is loaded', () => {
  const urls = loaded(path.join(REPO, 'workshop', 'js-harness-workshop.mjs'), ['throughput', 'status']);
  assert.ok(urls.some((url) => url.startsWith(`${WORKSHOP}bin/`)), 'the workshop throughput loaded none of workshop/bin, so the hook records nothing');
});
