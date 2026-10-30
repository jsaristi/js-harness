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
import { agentsTemplate, initProject } from './project.mjs';
import { sha256 } from './manifest.mjs';
import { candidateProjects, context7Gaps, gentleLeftovers } from './project-migrate.mjs';

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
  } finally {
    cleanup(claudeHome, dir, home, recent, stale);
  }
});
