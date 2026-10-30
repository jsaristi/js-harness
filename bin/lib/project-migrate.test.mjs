// The migration of a project an older release initialized (F8 S12, odd/tasks/f8-s12-migration.md): what it would
// write, read-only; what it writes, keeping the project's edits and recording each write; what gentle-ai left; and
// the projects the move list is chosen from. Every test runs a real `git`, isolated from the host's config as
// project.test.mjs is, in a project made for it under the system's temporary folder.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { InitWriteError, agentsTemplate, claudeTemplate, initProject, uninstallProject } from './project.mjs';
import { sha256 } from './manifest.mjs';
import { candidateProjects, context7Gaps, gentleLeftovers, migrateProject, migrationPlan } from './project-migrate.mjs';

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '[user]\n\tname = t\n\temail = t@example.com\n');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

const read = (file) => fs.readFileSync(file, 'utf8');
const git = (dir, ...args) => {
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
};
const commitAll = (dir) => {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--no-verify', '-m', 'state');
};
const RUNNING = '0.97.0';
const TODAY = '2026-10-30';
/** A home with no host config at all, so context7 reads as registered nowhere. */
const emptyHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-home-'));
const OURS = '\n## Our own\n- a line the project added\n';

/** A project as v0.97.0's `init` left it, then committed: `harness.json` pinning `pin`, `AGENTS.md` with the whole
 * block and a line the project added after it, no `CLAUDE.md`, no baseline in the manifest. */
function oldProject({ pin = '0.9.0', agents = (dir) => agentsTemplate(dir, { split: false }) + OURS } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-'));
  git(dir, 'init', '-q');
  const result = initProject(dir, pin, { today: '2026-10-01' });
  assert.equal(result.code, 0);
  fs.rmSync(path.join(dir, 'CLAUDE.md'));
  const written = agentsTemplate(dir, { split: false });
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), agents(dir));
  const manifest = JSON.parse(read(result.manifestPath));
  manifest.files = manifest.files
    .filter((file) => file.path !== 'CLAUDE.md')
    .map((file) => (file.path === 'AGENTS.md' ? { ...file, sha256: sha256(written) } : file));
  delete manifest.coverage;
  fs.writeFileSync(result.manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  commitAll(dir);
  return { dir, manifestPath: result.manifestPath, home: emptyHome() };
}

function cleanup(...dirs) {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
}

/** Every file under `dir` but git's own, with its bytes, to tell that nothing was written. */
function tree(dir) {
  const out = {};
  const walk = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = read(full);
    }
  };
  walk(dir);
  return out;
}

test('migrate writes the split, moves the pin and records the baseline, keeping the line the project added', () => {
  const { dir, manifestPath, home } = oldProject();
  try {
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 0, JSON.stringify(result));
    assert.equal(read(path.join(dir, 'CLAUDE.md')), claudeTemplate());
    // sync rendered AGENTS.md's half once CLAUDE.md held the other, and the project's line stayed.
    assert.equal(read(path.join(dir, 'AGENTS.md')), agentsTemplate(dir) + OURS);
    assert.equal(JSON.parse(read(path.join(dir, 'harness.json'))).version, RUNNING);
    const manifest = JSON.parse(read(manifestPath));
    assert.equal(manifest.version, RUNNING);
    assert.deepEqual(manifest.coverage, { baseline: TODAY, release: RUNNING });
    assert.deepEqual(manifest.files.find((file) => file.path === 'CLAUDE.md'), { path: 'CLAUDE.md', sha256: sha256(claudeTemplate()) });
    // harness.json was still the bytes init wrote, so its record follows the new ones.
    assert.equal(manifest.files.find((file) => file.path === 'harness.json').sha256, sha256(read(path.join(dir, 'harness.json'))));
    assert.deepEqual(result.committed.sort(), ['AGENTS.md', 'CLAUDE.md', 'harness.json']);
    for (const kind of ['pinMoved', 'wrote', 'baseline']) assert.ok(result.actions.some((action) => action.kind === kind), kind);
  } finally {
    cleanup(dir, home);
  }
});

test('a second migrate finds nothing to write, and the plan says so', () => {
  const { dir, home } = oldProject();
  try {
    assert.equal(migrateProject(dir, RUNNING, { home, today: TODAY }).code, 0);
    commitAll(dir);
    const before = tree(dir);
    const again = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(again.code, 0);
    assert.equal(again.upToDate, true, JSON.stringify(again.actions));
    assert.deepEqual(tree(dir), before);
    assert.deepEqual(migrationPlan(dir, RUNNING, { home, today: TODAY }).pending, []);
  } finally {
    cleanup(dir, home);
  }
});

test('the plan names what migrate would write and writes nothing', () => {
  const { dir, home } = oldProject();
  try {
    const before = tree(dir);
    const plan = migrationPlan(dir, RUNNING, { home, today: TODAY });
    assert.equal(plan.code, 0);
    assert.deepEqual(tree(dir), before);
    const said = plan.pending.join('\n');
    assert.match(said, /harness\.json: the pin 0\.9\.0 moves to 0\.97\.0/);
    assert.match(said, /CLAUDE\.md: written, importing AGENTS\.md/);
    assert.match(said, /the coverage baseline: recorded as 2026-10-30/);
    assert.match(said, /AGENTS\.md: its block is rendered again/);
  } finally {
    cleanup(dir, home);
  }
});

test('uninstall project after migrate removes the CLAUDE.md the migration wrote', () => {
  const { dir, home } = oldProject({ pin: RUNNING });
  try {
    assert.equal(migrateProject(dir, RUNNING, { home, today: TODAY }).code, 0);
    assert.equal(uninstallProject(dir).code, 0);
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'harness.json')), false);
  } finally {
    cleanup(dir, home);
  }
});

test('an edited block in AGENTS.md gets a CLAUDE.md that imports it alone, and AGENTS.md is left with a note', () => {
  const edited = (dir) => agentsTemplate(dir, { split: false }).replace('Work here is done properly', 'Work here is done our way');
  const { dir, home } = oldProject({ agents: edited });
  try {
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 0);
    const claude = read(path.join(dir, 'CLAUDE.md'));
    assert.match(claude, /^@AGENTS\.md$/m);
    assert.doesNotMatch(claude, /js-harness block/);
    assert.equal(read(path.join(dir, 'AGENTS.md')), edited(dir));
    assert.ok(result.notes.some((note) => note.path === 'AGENTS.md' && /edited/.test(note.reason)), JSON.stringify(result.notes));
  } finally {
    cleanup(dir, home);
  }
});

test("a CLAUDE.md of the project's is never written, and one without the import gets a note naming the line", () => {
  const { dir, home } = oldProject();
  try {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Ours\nWe write our own.\n');
    commitAll(dir);
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 0);
    assert.equal(read(path.join(dir, 'CLAUDE.md')), '# Ours\nWe write our own.\n');
    assert.ok(result.notes.some((note) => note.path === 'CLAUDE.md' && note.reason.includes('@AGENTS.md')), JSON.stringify(result.notes));
  } finally {
    cleanup(dir, home);
  }
});

test('a harness.json the project edited keeps its edit, gets its pin moved, and stays the project\'s in the record', () => {
  const { dir, manifestPath, home } = oldProject();
  try {
    const recorded = JSON.parse(read(manifestPath)).files.find((file) => file.path === 'harness.json').sha256;
    const edited = read(path.join(dir, 'harness.json')).replace('"reply": true', '"reply": true,\n  "functions": { "codeMap": "off" }');
    fs.writeFileSync(path.join(dir, 'harness.json'), edited);
    commitAll(dir);
    assert.equal(migrateProject(dir, RUNNING, { home, today: TODAY }).code, 0);
    assert.equal(read(path.join(dir, 'harness.json')), edited.replace('"version": "0.9.0"', `"version": "${RUNNING}"`));
    assert.equal(JSON.parse(read(manifestPath)).files.find((file) => file.path === 'harness.json').sha256, recorded);
  } finally {
    cleanup(dir, home);
  }
});

test('a pin newer than this copy is refused, and nothing is written', () => {
  const { dir, home } = oldProject({ pin: '0.99.0' });
  try {
    const before = tree(dir);
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.deepEqual({ code: result.code, pinNewer: result.pinNewer, pin: result.pin }, { code: 1, pinNewer: true, pin: '0.99.0' });
    assert.deepEqual(tree(dir), before);
  } finally {
    cleanup(dir, home);
  }
});

test('a file the migration writes with an uncommitted change is refused, and nothing is written', () => {
  const { dir, home } = oldProject();
  try {
    fs.appendFileSync(path.join(dir, 'AGENTS.md'), '- not committed yet\n');
    const before = tree(dir);
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 1);
    assert.deepEqual(result.uncommitted, ['AGENTS.md']);
    assert.deepEqual(tree(dir), before);
  } finally {
    cleanup(dir, home);
  }
});

test('a baseline that would turn a rule without a control into a finding is not recorded, and the note names it', () => {
  const { dir, manifestPath, home } = oldProject();
  try {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    const rule = { id: 'keep-it-short', subject: 'the project keeps its own line', since: '2026-10-01', path: 'AGENTS.md', phrases: ['a line the project added'] };
    const rules = { format: 1, rules: [rule] };
    fs.writeFileSync(path.join(dir, 'docs', 'rules.json'), JSON.stringify(rules, null, 2) + '\n');
    commitAll(dir);
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 0);
    assert.equal(JSON.parse(read(manifestPath)).coverage, undefined);
    assert.ok(result.notes.some((note) => note.path === 'the coverage baseline' && note.reason.includes('keep-it-short')), JSON.stringify(result.notes));
  } finally {
    cleanup(dir, home);
  }
});

test('a write that fails takes back everything the migration wrote before it', () => {
  const { dir, manifestPath, home } = oldProject();
  try {
    const before = tree(dir);
    const manifestBefore = read(manifestPath);
    const writeFile = (file, ...rest) => {
      if (path.basename(file) === 'harness.json') throw new Error('disk full');
      return fs.writeFileSync(file, ...rest);
    };
    assert.throws(() => migrateProject(dir, RUNNING, { home, today: TODAY, writeFile }), /disk full/);
    assert.deepEqual(tree(dir), before);
    assert.equal(read(manifestPath), manifestBefore);
  } finally {
    cleanup(dir, home);
  }
});

test('a write that cannot be taken back is named by its own file, whichever of the two it is', () => {
  for (const stuck of ['CLAUDE.md', 'harness.json']) {
    const { dir, home } = oldProject();
    try {
      const harnessJson = path.join(dir, 'harness.json');
      const pinned = read(harnessJson);
      let written = 0;
      const writeFile = (file, ...rest) => {
        // The second write of harness.json is the one that puts its old bytes back.
        if (path.resolve(file) === path.resolve(harnessJson) && written++ === 1 && stuck === 'harness.json') throw new Error('locked');
        return fs.writeFileSync(file, ...rest);
      };
      const removeFile = (file, ...rest) => {
        if (stuck === 'CLAUDE.md') throw new Error('locked');
        return fs.rmSync(file, ...rest);
      };
      const write = () => {
        throw new Error('disk full');
      };
      let thrown;
      try {
        migrateProject(dir, RUNNING, { home, today: TODAY, writeFile, removeFile, write });
      } catch (err) {
        thrown = err;
      }
      assert.ok(thrown instanceof InitWriteError, String(thrown));
      assert.deepEqual(thrown.notRemoved, [stuck]);
      assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), stuck === 'CLAUDE.md');
      assert.equal(read(harnessJson) === pinned, stuck !== 'harness.json');
    } finally {
      cleanup(dir, home);
    }
  }
});

test('a write that fails halfway is taken back too: the half-written file is gone or its old bytes are back', () => {
  for (const name of ['CLAUDE.md', 'harness.json']) {
    const { dir, manifestPath, home } = oldProject();
    try {
      const before = tree(dir);
      const manifestBefore = read(manifestPath);
      let failed = false;
      const writeFile = (file, ...rest) => {
        if (!failed && path.basename(file) === name) {
          failed = true;
          fs.writeFileSync(file, '{ "half');
          throw new Error('disk full');
        }
        return fs.writeFileSync(file, ...rest);
      };
      assert.throws(() => migrateProject(dir, RUNNING, { home, today: TODAY, writeFile }), /disk full/);
      assert.deepEqual(tree(dir), before, name);
      assert.equal(read(manifestPath), manifestBefore);
    } finally {
      cleanup(dir, home);
    }
  }
});

test('a harness.json that is a link is refused before any write: git could not give its target back', (t) => {
  const { dir, home } = oldProject();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-outside-'));
  try {
    const target = path.join(outside, 'harness.json');
    fs.copyFileSync(path.join(dir, 'harness.json'), target);
    fs.rmSync(path.join(dir, 'harness.json'));
    try {
      fs.symlinkSync(target, path.join(dir, 'harness.json'), 'file');
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EACCES') return t.skip('symlinks need privileges on this machine');
      throw err;
    }
    commitAll(dir);
    const targetBefore = read(target);
    const before = tree(dir);
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 1);
    assert.equal(result.pinUnmovable, true);
    assert.equal(result.link, true);
    assert.equal(read(target), targetBefore);
    assert.deepEqual(tree(dir), before);
  } finally {
    cleanup(dir, home, outside);
  }
});

test('an AGENTS.md git ignores is refused like an uncommitted one: git could not give its bytes back', () => {
  const { dir, home } = oldProject({ pin: RUNNING });
  try {
    git(dir, 'rm', '-q', '--cached', 'AGENTS.md');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'AGENTS.md\n');
    commitAll(dir);
    const before = tree(dir);
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 1);
    assert.deepEqual(result.uncommitted, ['AGENTS.md']);
    assert.deepEqual(tree(dir), before);
  } finally {
    cleanup(dir, home);
  }
});

test('an untracked AGENTS.md is refused even where git is told not to show untracked files', () => {
  const { dir, home } = oldProject({ pin: RUNNING });
  try {
    git(dir, 'rm', '-q', '--cached', 'AGENTS.md');
    git(dir, 'commit', '-q', '--no-verify', '-m', 'AGENTS.md untracked');
    git(dir, 'config', 'status.showUntrackedFiles', 'no');
    const before = tree(dir);
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 1);
    assert.deepEqual(result.uncommitted, ['AGENTS.md']);
    assert.deepEqual(tree(dir), before);
  } finally {
    cleanup(dir, home);
  }
});

test("the plan leaves git's index as it was: no stat refresh, no lock", () => {
  const { dir, home } = oldProject();
  try {
    const index = path.join(dir, '.git', 'index');
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(dir, 'AGENTS.md'), later, later);
    const before = fs.readFileSync(index);
    migrationPlan(dir, RUNNING, { home, today: TODAY });
    assert.ok(fs.readFileSync(index).equals(before));
  } finally {
    cleanup(dir, home);
  }
});

test('a CLAUDE.md the project deleted after init wrote it stays deleted, with a note', () => {
  const { dir, manifestPath, home } = oldProject({ pin: RUNNING });
  try {
    assert.equal(migrateProject(dir, RUNNING, { home, today: TODAY }).code, 0);
    commitAll(dir);
    git(dir, 'rm', '-q', 'CLAUDE.md');
    git(dir, 'commit', '-q', '--no-verify', '-m', 'no CLAUDE.md');
    const plan = migrationPlan(dir, RUNNING, { home, today: TODAY });
    assert.ok(!plan.pending.some((line) => line.startsWith('CLAUDE.md')), plan.pending.join('\n'));
    assert.ok(plan.notes.some((note) => note.path === 'CLAUDE.md' && /deleted/.test(note.reason)), JSON.stringify(plan.notes));
    migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false);
    assert.equal(JSON.parse(read(manifestPath)).files.filter((item) => item.path === 'CLAUDE.md').length, 1);
  } finally {
    cleanup(dir, home);
  }
});

test('with CLAUDE.md a link to AGENTS.md, the plan says what migrate writes, and nothing after it', (t) => {
  const { dir, home } = oldProject({ pin: RUNNING });
  try {
    try {
      fs.symlinkSync('AGENTS.md', path.join(dir, 'CLAUDE.md'), 'file');
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EACCES') return t.skip('symlinks need privileges on this machine');
      throw err;
    }
    commitAll(dir);
    const plan = migrationPlan(dir, RUNNING, { home, today: TODAY }).pending;
    const result = migrateProject(dir, RUNNING, { home, today: TODAY });
    assert.equal(result.code, 0);
    assert.equal(plan.some((line) => line.startsWith('AGENTS.md')), result.committed.includes('AGENTS.md'), plan.join('\n'));
    commitAll(dir);
    assert.deepEqual(migrationPlan(dir, RUNNING, { home, today: TODAY }).pending, []);
  } finally {
    cleanup(dir, home);
  }
});

test('a harness.json checked out with CRLF is still the one init wrote: after the pin moves, uninstall removes it', () => {
  const { dir, manifestPath, home } = oldProject();
  try {
    const file = path.join(dir, 'harness.json');
    fs.writeFileSync(file, read(file).replace(/\n/g, '\r\n'));
    commitAll(dir);
    assert.equal(migrateProject(dir, RUNNING, { home, today: TODAY }).code, 0);
    const entry = JSON.parse(read(manifestPath)).files.find((item) => item.path === 'harness.json');
    assert.equal(entry.sha256, sha256(read(file).replace(/\r\n/g, '\n')));
    commitAll(dir);
    uninstallProject(dir);
    assert.equal(fs.existsSync(file), false);
  } finally {
    cleanup(dir, home);
  }
});

test("the plan names what sync would repair: a recorded gate that is gone and the .atl/ exclude line's record", () => {
  const { dir, manifestPath, home } = oldProject({ pin: RUNNING });
  try {
    assert.equal(migrateProject(dir, RUNNING, { home, today: TODAY }).code, 0);
    commitAll(dir);
    assert.deepEqual(migrationPlan(dir, RUNNING, { home, today: TODAY }).pending, []);
    fs.rmSync(path.join(dir, '.git', 'hooks', 'pre-commit'));
    const manifest = JSON.parse(read(manifestPath));
    delete manifest.exclude;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const pending = migrationPlan(dir, RUNNING, { home, today: TODAY }).pending.join('\n');
    assert.match(pending, /pre-commit/);
    assert.match(pending, /\.atl\//);
  } finally {
    cleanup(dir, home);
  }
});

test("a failure in sync's part names what the migration wrote before it, which stays recorded", () => {
  const { dir, manifestPath, home } = oldProject();
  try {
    let writes = 0;
    // The migration's manifest write is the first; sync's, which records the version, the second.
    const write = (fd, ...rest) => {
      if (++writes === 2) throw new Error('disk full');
      return fs.writeSync(fd, ...rest);
    };
    let thrown;
    try {
      migrateProject(dir, RUNNING, { home, today: TODAY, write });
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown instanceof InitWriteError, String(thrown));
    assert.deepEqual(thrown.migrated, ['CLAUDE.md', 'harness.json', 'the coverage baseline']);
    assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
    assert.ok(JSON.parse(read(manifestPath)).files.some((item) => item.path === 'CLAUDE.md'));
  } finally {
    cleanup(dir, home);
  }
});

test('context7 registered nowhere is said with each host fix, and nothing is registered', () => {
  const { dir, home } = oldProject();
  try {
    const top = git(dir, 'rev-parse', '--show-toplevel').trim();
    const fixes = context7Gaps(top, { home }).map((gap) => gap.fix).join('\n');
    assert.match(fixes, /claude mcp add -s user --transport http context7/);
    assert.match(fixes, /codex mcp add context7 .*opens context7's sign-in in a browser/);
    assert.equal(fs.existsSync(path.join(home, '.claude.json')), false);
  } finally {
    cleanup(dir, home);
  }
});

test('context7 turned off for this project is said with the /mcp fix', () => {
  const { dir, home } = oldProject();
  try {
    const top = git(dir, 'rev-parse', '--show-toplevel').trim();
    const config = { mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } }, projects: { [top]: { disabledMcpServers: ['context7'] } } };
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify(config));
    const gaps = context7Gaps(top, { home });
    assert.ok(gaps.some((gap) => gap.where === 'project' && /\/mcp/.test(gap.fix)), JSON.stringify(gaps));
    assert.ok(!gaps.some((gap) => gap.where === 'claude'), 'registered for Claude, so no claude gap');
  } finally {
    cleanup(dir, home);
  }
});

test("gentle-ai's leftovers are named read-only: .atl/, its review store, and the odd/ documents that stay", () => {
  const { dir, home } = oldProject();
  try {
    assert.deepEqual(gentleLeftovers(dir), []);
    fs.mkdirSync(path.join(dir, '.atl'));
    fs.writeFileSync(path.join(dir, '.atl', 'skill-registry.md'), 'registry\n');
    const store = path.join(dir, '.git', 'gentle-ai', 'review-transactions');
    fs.mkdirSync(store, { recursive: true });
    fs.writeFileSync(path.join(store, 'one.json'), '{}\n');
    fs.mkdirSync(path.join(dir, 'odd', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'odd', 'tasks', 'a.md'), '# a\n');
    const before = tree(dir);
    const found = gentleLeftovers(dir);
    assert.deepEqual(found.map((item) => item.path), ['.atl/', '.git/gentle-ai/', 'odd/']);
    assert.match(found[0].how, /by hand/);
    assert.match(found[2].how, /stay/);
    assert.deepEqual(tree(dir), before);
  } finally {
    cleanup(dir, home);
  }
});

test('the candidates are the folders of sessions of the last 30 days and every initialized project sessions name', () => {
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-claude-'));
  const { dir, home } = oldProject({ pin: RUNNING });
  const recent = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-recent-'));
  const stale = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-migrate-stale-'));
  try {
    const now = Date.parse('2026-10-30T12:00:00Z');
    const session = (folder, cwd, daysAgo) => {
      const at = path.join(claudeHome, 'projects', folder);
      fs.mkdirSync(at, { recursive: true });
      const file = path.join(at, `${folder}.jsonl`);
      fs.writeFileSync(file, `${JSON.stringify({ type: 'user', cwd, message: 'hi' })}\n`);
      const time = new Date(now - daysAgo * 86_400_000);
      fs.utimesSync(file, time, time);
    };
    session('recent', recent, 2);
    session('stale', stale, 40);
    session('initialized', dir, 45);
    let found = candidateProjects({ claudeHome, now });
    let by = Object.fromEntries(found.map((item) => [path.resolve(item.path), item]));
    assert.equal(by[path.resolve(recent)].days, 2);
    // A session written a moment ago may carry a time a little past `now` (seen in bin/migrate.test.mjs): 0 days.
    session('ahead', recent, -0.0001);
    found = candidateProjects({ claudeHome, now });
    by = Object.fromEntries(found.map((item) => [path.resolve(item.path), item]));
    assert.equal(by[path.resolve(recent)].days, 0);
    assert.equal(by[path.resolve(recent)].initialized, false);
    assert.equal(by[path.resolve(stale)], undefined);
    assert.deepEqual({ initialized: by[path.resolve(dir)].initialized, pin: by[path.resolve(dir)].pin }, { initialized: true, pin: RUNNING });
    // A session in a folder inside a repository, such as a worktree's folder git no longer links, is its top level's.
    session('inside', path.join(dir, 'docs'), 1);
    found = candidateProjects({ claudeHome, now });
    by = Object.fromEntries(found.map((item) => [path.resolve(item.path), item]));
    assert.equal(by[path.resolve(dir, 'docs')], undefined);
    assert.equal(by[path.resolve(dir)].days, 1);
  } finally {
    cleanup(claudeHome, dir, home, recent, stale);
  }
});
