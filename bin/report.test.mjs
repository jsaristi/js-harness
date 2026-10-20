import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendNotice, newNotice, readNotices } from './lib/channel.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { reportMain, USAGE } from './report.mjs';

// odd/tasks/status-report.md, S2-S5: `js-harness report` against a repository and a harness home of its own in
// the temp folder. The repository has two merged pull requests, one before the cut and one after; the home's
// record holds the notices. Nothing here reads the real home or this repository.

const NOW = Date.parse('2026-10-20T12:00:00Z');
const run = (cmd, args, options) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, ...options });

function git(cwd, args, when = '2026-10-20T10:00:00Z') {
  const env = { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const result = run('git', ['-c', 'maintenance.auto=false', '-c', 'commit.gpgsign=false', ...args], { cwd, env });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

/** A pull request merged into main. With `syncMain`, main moves on while the branch is open and the branch merges
 * main in before it lands, as a branch brought up to date does. */
function mergePullRequest(repo, number, branch, subject, when, { syncMain = false } = {}) {
  git(repo, ['switch', '-q', '-c', branch, 'main'], when);
  fs.writeFileSync(path.join(repo, `${branch.replace('/', '-')}.txt`), branch);
  git(repo, ['add', '.'], when);
  git(repo, ['commit', '-q', '-m', subject], when);
  if (syncMain) {
    git(repo, ['switch', '-q', 'main'], when);
    fs.writeFileSync(path.join(repo, 'on-main.txt'), 'main moved');
    git(repo, ['add', '.'], when);
    git(repo, ['commit', '-q', '-m', 'docs: a commit straight on main'], when);
    git(repo, ['switch', '-q', branch], when);
    git(repo, ['merge', '-q', '--no-ff', '-m', `Merge branch 'main' into ${branch}`, 'main'], when);
  }
  git(repo, ['switch', '-q', 'main'], when);
  git(repo, ['merge', '-q', '--no-ff', '-m', `Merge pull request #${number} from ${branch}`, branch], when);
}

/** A repository with a roadmap on main and two pull requests merged, a harness home, and the project's slug. */
function withProject(body) {
  return async () => {
    const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-report-'));
    const repo = path.join(top, 'repo');
    const home = path.join(top, 'home');
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    try {
      git(top, ['init', '-q', '-b', 'main', repo]);
      fs.writeFileSync(path.join(repo, 'docs', 'ROADMAP.md'), '# Roadmap\n\n## Checklist\n\n### One\n- [x] a\n- [ ] b still open\n\n### Two\n- [x] c\n');
      git(repo, ['add', '.'], '2026-10-01T00:00:00Z');
      git(repo, ['commit', '-q', '-m', 'docs: the roadmap'], '2026-10-01T00:00:00Z');
      mergePullRequest(repo, 470, 'feat/old', 'feat: old work', '2026-10-18T10:00:00Z');
      mergePullRequest(repo, 478, 'fix/title', 'fix(notify): read the title', '2026-10-20T10:00:00Z', { syncMain: true });
      const slug = projectSlug(mainCheckout(run, repo));
      await body({ repo, home, slug });
    } finally {
      fs.rmSync(top, { recursive: true, force: true });
    }
  };
}

async function report(argv, { repo, home }, env = {}) {
  const out = [];
  const err = [];
  const code = await reportMain([...argv, '--cwd', repo, '--home', home], { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => NOW, env });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const FROM = { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title: 'JH 35 · notify reads title' };

test('with no report recorded, it reports the last 24 hours: the pull request merged in them, the notices, the questions and the map', withProject(async (project) => {
  appendNotice(project.home, project.slug, newNotice({ at: '2026-10-20T11:00:00.000Z', from: FROM, to: 'orchestrator', kind: 'closed', text: 'delivered the title fix', summary: 'docs/sessions/x.md' }));
  appendNotice(project.home, project.slug, newNotice({ at: '2026-10-20T11:05:00.000Z', from: FROM, to: 'orchestrator', kind: 'question', id: 'q-1', text: 'Ship it today?', options: [], waits: 'the release' }));
  const { code, out, err } = await report([], project);
  assert.equal(err, '');
  assert.equal(code, 0);
  assert.match(out, /^Since 2026-10-19 12:00Z, the last 24 hours: no report is recorded$/m);
  assert.match(out, /^Landed on main: 1 pull request$/m);
  assert.match(out, /^ {2}#478 fix\/title {2}merged 2026-10-20 10:00Z$/m);
  assert.match(out, /^ {6}- fix\(notify\): read the title$/m);
  assert.doesNotMatch(out, /#470/);
  assert.doesNotMatch(out, /Merge branch 'main'|a commit straight on main/, 'a pull request lists its own commits, not the merges that brought main in');
  assert.match(out, /^ {2}JH 35 · notify reads title {2}question 2026-10-20 11:05Z {2}\(2 notices\)$/m);
  assert.match(out, /^ {2}open #1 since 2026-10-20 11:05Z: Ship it today\?$/m);
  assert.match(out, /^Map: docs\/ROADMAP.md on main {2}2\/3 {2}67%$/m);
  assert.match(out, /^ {6}- b still open$/m);
}));

test('reading writes nothing; --mark records the report, and the next report starts there', withProject(async (project) => {
  await report([], project);
  assert.deepEqual(readNotices(project.home, project.slug).reports, []);
  const marked = await report(['--mark'], project, { CLAUDE_CODE_SESSION_ID: 'cccccccc-3333-4333-8333-333333333333' });
  assert.equal(marked.code, 0);
  assert.match(marked.out, /^Recorded this report at 2026-10-20 12:00Z$/m);
  const { reports, notices, skipped } = readNotices(project.home, project.slug);
  assert.deepEqual(reports.map((one) => [one.at, one.by]), [['2026-10-20T12:00:00.000Z', 'cccccccc-3333-4333-8333-333333333333']]);
  assert.deepEqual(notices, []);
  assert.equal(skipped, 0);
  const next = await report([], project);
  assert.match(next.out, /^Since 2026-10-20 12:00Z, the last report$/m);
  assert.match(next.out, /^Landed on main: nothing since the cut$/m);
}));

test('--since sets the cut, and takes in what the default window leaves out', withProject(async (project) => {
  const { code, out } = await report(['--since', '2026-10-17T00:00:00Z'], project);
  assert.equal(code, 0);
  assert.match(out, /^Since 2026-10-17 00:00Z, as --since asked$/m);
  assert.match(out, /^Landed on main: 2 pull requests$/m);
  assert.match(out, /#470 feat\/old/);
}));

test('outside a repository the git sections say why, the rest still prints, and it exits 1', async () => {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-report-norepo-'));
  try {
    const { code, out } = await report([], { repo: top, home: path.join(top, 'home') });
    assert.equal(code, 1);
    assert.match(out, /^Landed on the default branch: could not read: /m);
    assert.match(out, /^Sessions: no notice since the cut$/m);
    assert.match(out, /^Map: could not read: /m);
  } finally {
    fs.rmSync(top, { recursive: true, force: true });
  }
});

test('an unknown argument, a --since that is no time and a --since with no value print the usage and exit 2', async () => {
  for (const argv of [['--what'], ['--since', 'yesterday'], ['--since'], ['extra']]) {
    const err = [];
    const code = await reportMain(argv, { stdout: () => {}, stderr: (line) => err.push(line), now: () => NOW, env: {} });
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.join('\n').includes(USAGE), argv.join(' '));
  }
});
