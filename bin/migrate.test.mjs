// `js-harness migrate` as a person runs it (F8 S12, odd/tasks/f8-s12-migration.md): its usage errors, the report of a
// migration, --check before and after it, a refusal, and `migrate list`. The engine's own cases are
// bin/lib/project-migrate.test.mjs; every real `git` call is isolated from the host's config as there.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { migrateMain } from './migrate.mjs';
import { agentsTemplate, initProject } from './lib/project.mjs';
import { sha256 } from './lib/manifest.mjs';

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-cli-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '[user]\n\tname = t\n\temail = t@example.com\n');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

const RUNNING = '0.97.0';
const git = (dir, ...args) => assert.equal(spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).status, 0, `git ${args.join(' ')}`);
const commitAll = (dir) => {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--no-verify', '-m', 'state');
};

/** A project as v0.97.0's `init` left it, pinned to 0.9.0 and committed, and an empty home beside it. */
function oldProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-cli-'));
  git(dir, 'init', '-q');
  const result = initProject(dir, '0.9.0', { today: '2026-10-01' });
  assert.equal(result.code, 0);
  fs.rmSync(path.join(dir, 'CLAUDE.md'));
  const agents = agentsTemplate(dir, { split: false });
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), agents);
  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
  manifest.files = manifest.files.filter((file) => file.path !== 'CLAUDE.md').map((file) => (file.path === 'AGENTS.md' ? { ...file, sha256: sha256(agents) } : file));
  delete manifest.coverage;
  fs.writeFileSync(result.manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  commitAll(dir);
  return { dir, home: fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-cli-home-')) };
}

/** `migrateMain(argv)` with what it printed, both streams. */
async function run(t, argv, deps = {}) {
  const out = [];
  const err = [];
  t.mock.method(console, 'log', (text) => out.push(text));
  t.mock.method(console, 'error', (text) => err.push(text));
  const code = await migrateMain(argv, {}, { version: RUNNING, today: '2026-10-30', ...deps });
  t.mock.restoreAll();
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('a flag migrate does not know, or --cwd given to list, is a usage error with exit 2', async (t) => {
  for (const argv of [['--force'], ['list', '--cwd', '.'], ['--cwd']]) {
    const result = await run(t, argv);
    assert.equal(result.code, 2, argv.join(' '));
    assert.match(result.err, /Usage: js-harness migrate/);
  }
});

test('--check says what migrate would write and exits 1; migrate writes it and says what to commit; --check then exits 0', async (t) => {
  const { dir, home } = oldProject();
  try {
    const check = await run(t, ['--check', '--cwd', dir, '--home', home]);
    assert.equal(check.code, 1, check.err);
    assert.match(check.out, /would write: harness\.json: the pin 0\.9\.0 moves to 0\.97\.0/, check.err);
    assert.match(check.out, /would write: CLAUDE\.md: written/);
    assert.match(check.out, /context7 is missing for claude: claude mcp add/);
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false);

    const migrated = await run(t, ['--cwd', dir, '--home', home]);
    assert.equal(migrated.code, 0, migrated.err);
    assert.match(migrated.out, /^wrote CLAUDE\.md$/m);
    assert.match(migrated.out, /^moved the pin of harness\.json from 0\.9\.0 to 0\.97\.0$/m);
    assert.match(migrated.out, /^recorded the coverage baseline 2026-10-30$/m);
    assert.match(migrated.out, /^commit what migrate changed: AGENTS\.md, CLAUDE\.md, harness\.json$/m);

    commitAll(dir);
    const after = await run(t, ['--check', '--cwd', dir, '--home', home]);
    assert.equal(after.code, 0, after.out);
    assert.match(after.out, /nothing to migrate: the project is what 0\.97\.0 writes/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a file migrate may write with an uncommitted change is refused with exit 1, naming it', async (t) => {
  const { dir, home } = oldProject();
  try {
    fs.appendFileSync(path.join(dir, 'harness.json'), '\n');
    const result = await run(t, ['--cwd', dir, '--home', home]);
    assert.equal(result.code, 1);
    assert.match(result.err, /^harness\.json holds a change git has not committed/);
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("a failure in sync's part says that what the migration wrote stays recorded, and names it", async (t) => {
  const { dir, home } = oldProject();
  try {
    let writes = 0;
    const write = (fd, ...rest) => {
      if (++writes === 2) throw new Error('disk full');
      return fs.writeSync(fd, ...rest);
    };
    const result = await run(t, ['--cwd', dir, '--home', home], { write });
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.err, /^migrate failed: disk full; nothing was left behind$/m);
    assert.match(result.err, /^migrate failed in sync's part: disk full; of sync's writes, nothing was left behind$/m);
    assert.match(result.err, /^what the migration wrote before it stays, recorded: CLAUDE\.md, harness\.json, the coverage baseline; commit it, then run js-harness sync once the cause is fixed$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("an error of sync's part that is no write's still says what the migration wrote, then is thrown", async (t) => {
  const { dir, home } = oldProject();
  try {
    const syncProject = () => {
      throw new TypeError('boom');
    };
    const err = [];
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', (text) => err.push(text));
    await assert.rejects(migrateMain(['--cwd', dir, '--home', home], {}, { version: RUNNING, today: '2026-10-30', syncProject }), /boom/);
    t.mock.restoreAll();
    assert.match(err.join('\n'), /^what the migration wrote before it stays, recorded: CLAUDE\.md, harness\.json, the coverage baseline; commit it, then run js-harness sync once the cause is fixed$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('migrate list names the folders of recent sessions read-only, and says none where there are none', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-cli-list-'));
  try {
    const empty = await run(t, ['list', '--home', home]);
    assert.equal(empty.code, 0);
    assert.match(empty.out, /^ {2}none$/m);
    const folder = path.join(home, '.claude', 'projects', 'one');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 's.jsonl'), `${JSON.stringify({ cwd: home })}\n`);
    const listed = await run(t, ['list', '--home', home]);
    assert.equal(listed.code, 0);
    assert.ok(listed.out.split('\n').some((line) => /0d {2}not initialized/.test(line) && line.endsWith(home)), listed.out);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
