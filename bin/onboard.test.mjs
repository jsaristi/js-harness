import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { onboardMain } from './onboard.mjs';
import {
  AGENTS_PATH, ONBOARDING_PATH, ORIGIN_PATH, ROADMAP_PATH, featureTemplate, originTemplate, roadmapTemplate, shortHash,
} from './lib/onboard.mjs';
import { files, onboardingDoc } from './lib/onboard.testkit.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';

// A real git runs here: not the host's configuration, nor the repository of a commit's hook (see
// bin/lib/project.test.mjs).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-onboard-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

const emptyRepo = repoTemplate((root) => {
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
});

/** A git repository holding `files`; `harness.json` makes it an initialized project unless `initialized` is false. */
function project(t, files = {}, { initialized = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-onboard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  emptyRepo(root);
  const all = initialized ? { 'harness.json': '{ "version": "0.95.0" }\n', ...files } : files;
  for (const [name, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

async function onboard(cwd, ...argv) {
  const out = [];
  const err = [];
  const code = await onboardMain(argv, process.env, { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('template prints each skeleton, and --write creates it once and never writes over it', async (t) => {
  const root = project(t);
  assert.deepEqual(await onboard(root, 'template', 'roadmap'), { code: 0, out: roadmapTemplate(), err: '' });
  assert.deepEqual(await onboard(root, 'template', 'origin'), { code: 0, out: originTemplate(path.basename(root)), err: '' });

  assert.deepEqual(await onboard(root, 'template', 'feature', '--write'), { code: 0, out: 'wrote odd/tasks/onboarding.md', err: '' });
  assert.equal(fs.readFileSync(path.join(root, 'odd/tasks/onboarding.md'), 'utf8'), featureTemplate());

  fs.writeFileSync(path.join(root, 'odd/tasks/onboarding.md'), 'the owner\'s answers');
  assert.deepEqual(await onboard(root, 'template', 'feature', '--write'), {
    code: 1,
    out: '',
    err: 'odd/tasks/onboarding.md exists: onboard never writes over a file',
  });
  assert.equal(fs.readFileSync(path.join(root, 'odd/tasks/onboarding.md'), 'utf8'), 'the owner\'s answers');
});

test('template --write refuses a directory on its way that is a link, and writes nothing outside the project', async (t) => {
  const root = project(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-onboard-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(root, 'docs'), 'junction');
  assert.deepEqual(await onboard(root, 'template', 'origin', '--write'), {
    code: 1,
    out: '',
    err: 'docs is a link: onboard writes only inside the project, so move it aside or write docs/origin.md by hand',
  });
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('hash prints each file\'s short sha256, and missing for a file that is not there', async (t) => {
  const root = project(t, { 'docs/origin.md': 'the pre-plan\n' });
  assert.deepEqual(await onboard(root, 'hash'), {
    code: 0,
    out: ['interview missing', `origin    sha256:${shortHash('the pre-plan\n')}`, 'roadmap   missing'].join('\n'),
    err: '',
  });
});

test('check names each finding with the stage it sends the work back to, and exits 1', async (t) => {
  const root = project(t, { 'AGENTS.md': '# shop\n' });
  const { code, out, err } = await onboard(root, 'check');
  assert.equal(code, 1);
  assert.equal(err, '');
  assert.deepEqual(out.split('\n'), [
    'FAIL  odd/tasks/onboarding.md: missing: js-harness onboard template feature --write starts it (back to stage 1, Read)',
    'FAIL  docs/origin.md: missing: js-harness onboard template origin --write starts it (back to stage 3, Pre-plan)',
    'FAIL  docs/ROADMAP.md: missing: js-harness onboard template roadmap --write starts it (back to stage 5, Plan)',
    'FAIL  AGENTS.md: has no line "The plan is docs/ROADMAP.md: a session starts there, and each feature\'s state is in odd/tasks/." (back to stage 7, Close)',
  ]);
});

test('check --plan reads only the roadmap; a complete one passes', async (t) => {
  const roadmap = [
    '# Roadmap', '', '## Phases', '| Phase | Goal | Done when | State |', '|---|---|---|---|',
    '| P1 Catalog | Bread on a page | `npm test` exits 0 | Not started |', '',
    '## Checklist', '', '### P1 Catalog', '- [ ] The page lists the bread', '',
    '## Next', 'P1 Catalog.', '', '## Open decisions', '- None.', '',
  ].join('\n');
  const root = project(t, { 'docs/ROADMAP.md': roadmap });
  assert.deepEqual(await onboard(root, 'check', '--plan'), { code: 0, out: 'PASS  docs/ROADMAP.md', err: '' });
});

test('outside an initialized project every verb refuses and names init', async (t) => {
  const root = project(t, {}, { initialized: false });
  const refusal = `not an initialized project: ${root}; js-harness init sets one up`;
  assert.deepEqual(await onboard(root), { code: 1, out: '', err: refusal });
  assert.deepEqual(await onboard(root, 'check'), { code: 1, out: '', err: refusal });
  assert.deepEqual(await onboard(root, 'template', 'roadmap', '--write'), { code: 1, out: '', err: refusal });
  assert.equal(fs.existsSync(path.join(root, 'docs')), false);
});

/** Runs git in `root` with a fixed identity; fails the test when git does. */
function git(root, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function write(root, files) {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
}

/** The onboarding's four files, complete and closed (O6 checked). */
const closed = () => {
  const { onboarding, origin, roadmap, agents } = files({ onboarding: onboardingDoc({ o6: 'x' }) });
  return { [ONBOARDING_PATH]: onboarding, [ORIGIN_PATH]: origin, [ROADMAP_PATH]: roadmap, [AGENTS_PATH]: agents };
};

/** A project whose `main` holds one commit. */
function committed(t) {
  const root = project(t);
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

test('bare onboard: a fresh project is at stage 1, and an uncommitted document is named', async (t) => {
  const root = committed(t);
  const fresh = await onboard(root);
  assert.equal(fresh.code, 0);
  assert.equal(fresh.err, '');
  assert.deepEqual(fresh.out.split('\n').slice(0, 2), [
    'Stage 1 of 7, Read: no onboarding document yet.',
    'First: git switch -c onboarding, the branch the onboarding is committed on, so a session in another worktree finds it.',
  ]);
  git(root, 'switch', '-q', '-c', 'onboarding');
  assert.equal((await onboard(root, 'template', 'feature', '--write')).code, 0);
  const started = (await onboard(root)).out.split('\n');
  assert.equal(started[0], 'Stage 1 of 7, Read: O1 is not checked yet.');
  assert.equal(started.at(-1), 'Not committed: odd/tasks/onboarding.md. Commit them on this branch, so the next session finds them.');
  // Committed, then edited again: git status starts the line with a space, which is no part of the path.
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'onboarding');
  assert.equal((await onboard(root)).out.split('\n').at(-1), 'Then: commit, and run js-harness onboard again.');
  fs.appendFileSync(path.join(root, ONBOARDING_PATH), '- L2 2026-10-19 An answer.\n');
  assert.equal((await onboard(root)).out.split('\n').at(-1), 'Not committed: odd/tasks/onboarding.md. Commit them on this branch, so the next session finds them.');
});

test('bare onboard: an onboarding on another branch is named, with its worktree or the switch that resumes it', async (t) => {
  const root = committed(t);
  git(root, 'switch', '-q', '-c', 'onboarding');
  write(root, { [ONBOARDING_PATH]: featureTemplate() });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'onboarding');
  git(root, 'switch', '-q', 'main');
  assert.deepEqual(await onboard(root), {
    code: 0,
    out: 'Onboarding in progress on branch onboarding: git switch onboarding resumes it here.',
    err: '',
  });
  const worktree = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-onboard-wt-')), 'onboarding');
  t.after(() => fs.rmSync(path.dirname(worktree), { recursive: true, force: true }));
  git(root, 'worktree', 'add', '-q', worktree, 'onboarding');
  const listed = git(root, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree '))[1].slice('worktree '.length);
  assert.equal((await onboard(root)).out, `Onboarding in progress on branch onboarding, checked out in ${listed}: open a session there and run js-harness onboard.`);
});

test('bare onboard: a remote branch holding the onboarding is named even when a local one of its name does not hold it', async (t) => {
  const root = committed(t);
  git(root, 'branch', 'onboarding');
  git(root, 'switch', '-q', '-c', 'fetched');
  write(root, { [ONBOARDING_PATH]: featureTemplate() });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'onboarding');
  git(root, 'update-ref', 'refs/remotes/origin/onboarding', 'fetched');
  git(root, 'switch', '-q', 'main');
  git(root, 'branch', '-D', 'fetched');
  assert.deepEqual(await onboard(root), {
    code: 0,
    out: 'Onboarding in progress on branch origin/onboarding: git switch onboarding, then git merge origin/onboarding, resumes it here.',
    err: '',
  });
});

test('bare onboard: a closed onboarding waits for its merge, and once merged points at the roadmap', async (t) => {
  const root = committed(t);
  git(root, 'switch', '-q', '-c', 'onboarding');
  write(root, closed());
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'onboarding');
  const waiting = await onboard(root);
  assert.equal(waiting.code, 0);
  assert.deepEqual(waiting.out.split('\n'), [
    'Awaiting merge: the onboarding is complete on branch onboarding, and main has no docs/ROADMAP.md yet.',
    'Merging it is the owner\'s decision, under this repository\'s policy. To propose it: git push -u origin onboarding, then gh pr create --base main --head onboarding.',
  ]);
  git(root, 'switch', '-q', 'main');
  git(root, 'merge', '-q', 'onboarding');
  git(root, 'switch', '-q', '-c', 'feat/catalog');
  assert.deepEqual(await onboard(root), { code: 0, out: 'Onboarded: docs/ROADMAP.md is the plan.\nNext: P1 Catalog, its first step.', err: '' });
});

test('bare onboard: a plan of its own is left alone, exit 1', async (t) => {
  const root = project(t, { [ROADMAP_PATH]: '# Roadmap\n' });
  const { code, out, err } = await onboard(root);
  assert.equal(code, 1);
  assert.equal(err, '');
  assert.equal(out.split('\n')[0], 'This project has a plan of its own: docs/ROADMAP.md.');
  assert.equal(fs.existsSync(path.join(root, ONBOARDING_PATH)), false);
});

test('an argument it does not take is a usage error, exit 2', async (t) => {
  const root = project(t);
  for (const argv of [['check', '--force'], ['template'], ['template', 'plan'], ['hash', 'extra'], ['check', '--cwd'], ['--plan'], ['--write'], ['stage']]) {
    const { code, err } = await onboard(root, ...argv);
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, /Usage: js-harness onboard/, argv.join(' '));
  }
});
