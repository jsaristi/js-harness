import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendNotice, newNotice, readNotices, recordPath } from './lib/channel.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { reportMain, USAGE } from './report.mjs';
import { stretchMain } from './stretch.mjs';

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

async function report(argv, { repo, home }, env = {}, now = NOW) {
  const out = [];
  const err = [];
  const code = await reportMain([...argv, '--cwd', repo, '--home', home], { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => now, env });
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
  const head = git(project.repo, ['rev-parse', 'main']).trim();
  assert.deepEqual(reports.map((one) => [one.at, one.by, one.head]), [['2026-10-20T12:00:00.000Z', 'cccccccc-3333-4333-8333-333333333333', head]]);
  assert.deepEqual(notices, []);
  assert.equal(skipped, 0);
  const next = await report([], project);
  assert.match(next.out, /^Since 2026-10-20 12:00Z, the last report$/m);
  assert.match(next.out, /^Landed on main: nothing since the cut$/m);
}));

// A review finding, R3-stale-origin-cut: a pull request merged before a report but fetched after it carries a merge time
// earlier than the report's, so a cut by time alone would never show it.
test('after a report, what landed is what the default branch gained since the commit that report saw, whatever its time', withProject(async (project) => {
  await report(['--mark'], project);
  mergePullRequest(project.repo, 480, 'fix/late', 'fix: merged before the report, fetched after', '2026-10-20T11:00:00Z');
  const next = await report([], project, {}, Date.parse('2026-10-20T13:00:00Z'));
  assert.equal(next.code, 0, next.err);
  assert.match(next.out, /^Landed on main: 1 pull request$/m);
  assert.match(next.out, /^ {2}#480 fix\/late {2}merged 2026-10-20 11:00Z$/m);
  assert.doesNotMatch(next.out, /#478/);
}));

test('a merge that names no pull request is counted apart from the pull requests', withProject(async (project) => {
  git(project.repo, ['switch', '-q', '-c', 'docs/hotfix', 'main'], '2026-10-20T11:00:00Z');
  fs.writeFileSync(path.join(project.repo, 'hotfix.txt'), 'x');
  git(project.repo, ['add', '.'], '2026-10-20T11:00:00Z');
  git(project.repo, ['commit', '-q', '-m', 'docs: a hotfix'], '2026-10-20T11:00:00Z');
  git(project.repo, ['switch', '-q', 'main'], '2026-10-20T11:00:00Z');
  git(project.repo, ['merge', '-q', '--no-ff', '-m', 'Merge branch docs/hotfix', 'docs/hotfix'], '2026-10-20T11:00:00Z');
  const { out } = await report([], project);
  assert.match(out, /^Landed on main: 1 pull request and 1 other merge$/m);
}));

// Codex review of ddd4058..0bf3ea7, part 2: `git ls-tree` reads a path from the folder it runs in.
test('run from a folder inside the repository, it still finds the roadmap', withProject(async (project) => {
  const { code, out } = await report([], { ...project, repo: path.join(project.repo, 'docs') });
  assert.equal(code, 0);
  assert.match(out, /^Map: docs\/ROADMAP.md on main {2}2\/3 {2}67%$/m);
}));

test('a default branch with no roadmap says so, and that is no error', withProject(async (project) => {
  git(project.repo, ['rm', '-q', 'docs/ROADMAP.md'], '2026-10-20T11:30:00Z');
  git(project.repo, ['commit', '-q', '-m', 'docs: drop the roadmap'], '2026-10-20T11:30:00Z');
  const { code, out } = await report([], project);
  assert.equal(code, 0);
  assert.match(out, /^Map: no docs\/ROADMAP.md on main$/m);
  // The reliability and resilience readers of 23c028a5 (CRITICAL): the page's plan steps read no roadmap that is not
  // there, so --mark --html records the report, as --mark alone does.
  const html = path.join(project.home, 'status.html');
  const recordLoad = async () => ({ renderedFile: () => path.join(project.home, 'rendered.jsonl'), recordRendered: () => ({ sha256: 'e'.repeat(64), bytes: 1 }) });
  const err = [];
  const marked = await reportMain(['--mark', '--html', html, '--cwd', project.repo, '--home', project.home], { stdout: () => {}, stderr: (line) => err.push(line), now: () => NOW, env: {}, recordLoad });
  assert.equal(marked, 0, err.join('\n'));
  assert.equal(readNotices(project.home, project.slug).reports.length, 1);
  assert.match(fs.readFileSync(html, 'utf8'), /La rama main no tiene docs\/ROADMAP\.md/);
}));

// Review findings R3-mark-after-failed-section and R3-untested-mark-failure.
test('a record that cannot be read is said in Sessions and Questions, exits 1, and --mark then records nothing', withProject(async (project) => {
  fs.mkdirSync(recordPath(project.home, project.slug), { recursive: true });
  const { code, out, err } = await report(['--mark'], project);
  assert.equal(code, 1);
  assert.match(out, /^Sessions: could not read: the record .+: EISDIR$/m);
  assert.match(out, /^Questions: could not read: the record .+: EISDIR$/m);
  assert.doesNotMatch(out, /Recorded this report/);
  assert.match(err, /^js-harness report: not recorded: a section could not be read, so the next report starts where this one did$/m);
}));

test('a report line that cannot be written exits 1 and says why', withProject(async (project) => {
  const out = [];
  const err = [];
  const appendReport = () => {
    throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  };
  const code = await reportMain(['--mark', '--cwd', project.repo, '--home', project.home], { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => NOW, env: {}, appendReport });
  assert.equal(code, 1);
  assert.doesNotMatch(out.join('\n'), /Recorded this report/);
  assert.deepEqual(err, ['js-harness report: the report was not recorded: EACCES']);
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

// odd/tasks/visual-pages.md, "The status report": --html writes the six sections as a page, with the map at the head
// the last --mark read as its before, the lead's notes labelled his, and the page put in the rendered record.
test('--html writes the status page with the map since the last mark and the notes, and records it as rendered', withProject(async (project) => {
  await report(['--mark'], project);
  fs.writeFileSync(path.join(project.repo, 'docs', 'ROADMAP.md'), '# Roadmap\n\n## Checklist\n\n### One\n- [x] a\n- [x] b still open\n\n### Two\n- [x] c\n');
  git(project.repo, ['commit', '-q', '-am', 'docs: b is done'], '2026-10-20T13:00:00Z');
  const notes = path.join(project.home, 'notes.json');
  fs.mkdirSync(project.home, { recursive: true });
  fs.writeFileSync(notes, JSON.stringify({ decisions: [{ text: 'Cerrar One', changed: 'nada queda' }] }));
  const html = path.join(project.home, 'out', 'status.html');
  const calls = [];
  const recordLoad = async () => ({ renderedFile: () => path.join(project.home, 'rendered.jsonl'), recordRendered: (file, entry) => { calls.push(entry); return { sha256: 'e'.repeat(64), bytes: 1 }; } });
  const out = [];
  const err = [];
  const later = Date.parse('2026-10-20T14:00:00Z');
  const code = await reportMain(['--html', html, '--notes', notes, '--cwd', project.repo, '--home', project.home], { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => later, env: {}, recordLoad });
  assert.equal(code, 0, err.join('\n'));
  const page = fs.readFileSync(html, 'utf8');
  assert.match(page, /^<title>Cómo vamos<\/title>/);
  assert.match(page, /One[\s\S]*1\/2[\s\S]*2\/2 · 100 %[\s\S]*cerrada/);
  assert.match(page, /Cerrar One[\s\S]*nada queda[\s\S]*del orquestador/);
  assert.match(page, /6\. Lo que propongo/);
  const head = git(project.repo, ['rev-parse', 'main']).trim();
  assert.deepEqual(calls, [{ template: 'status-report', subject: 'status', path: html, at: '2026-10-20T14:00:00.000Z', head }]);
  assert.match(out.join('\n'), /in the rendered record/);
}));

// Review 00598536's warning on C2: a relative --notes is read where a relative --html is written, under --cwd, as stretch's
// --html is; run from elsewhere, the notes are not read from one folder and the page written in another.
test('a relative --notes and --html both resolve under --cwd, wherever the command runs from', withProject(async (project) => {
  fs.mkdirSync(project.home, { recursive: true });
  fs.writeFileSync(path.join(project.repo, 'notes.json'), JSON.stringify({ proposals: [{ step: 'Tramo C', why: 'faltan páginas' }] }));
  const recordLoad = async () => ({ renderedFile: () => path.join(project.home, 'rendered.jsonl'), recordRendered: () => ({ sha256: 'e'.repeat(64), bytes: 1 }) });
  const err = [];
  const code = await reportMain(['--html', path.join('out', 'status.html'), '--notes', 'notes.json', '--cwd', project.repo, '--home', project.home], { cwd: project.home, stdout: () => {}, stderr: (line) => err.push(line), env: {}, recordLoad });
  assert.equal(code, 0, err.join('\n'));
  assert.match(fs.readFileSync(path.join(project.repo, 'out', 'status.html'), 'utf8'), /Tramo C[\s\S]*faltan páginas/);
}));

// odd/tasks/departure-stretch.md, spec 9: a marked report's proposals and estimates are the next page's to compare.
test('--mark records the proposals and their estimates, and the next page sets them beside what landed since', withProject(async (project) => {
  fs.mkdirSync(project.home, { recursive: true });
  const notes = path.join(project.home, 'notes.json');
  fs.writeFileSync(notes, JSON.stringify({ proposals: [{ step: 'Tramo D', why: 'falta el mapa', estimate: '2 h, PR 740 en main' }] }));
  const recordLoad = async () => ({ renderedFile: () => path.join(project.home, 'rendered.jsonl'), recordRendered: () => ({ sha256: 'e'.repeat(64), bytes: 1 }) });
  const run = (argv, at) => reportMain([...argv, '--cwd', project.repo, '--home', project.home], { stdout: () => {}, stderr: () => {}, now: () => at, env: {}, recordLoad });
  assert.equal(await run(['--mark', '--html', path.join(project.home, 'one.html'), '--notes', notes], NOW), 0);
  assert.deepEqual(readNotices(project.home, project.slug).reports.at(-1).proposals, [{ step: 'Tramo D', estimate: '2 h, PR 740 en main' }]);
  const next = path.join(project.home, 'two.html');
  assert.equal(await run(['--html', next], NOW + 3_600_000), 0);
  assert.match(fs.readFileSync(next, 'utf8').split('6. Lo que propongo')[1], /Lo que propuse el[\s\S]*Tramo D[\s\S]*2 h, PR 740 en main[\s\S]*Desde entonces no entró nada/);
}));

// Codex review of 6bee9e5..8be755d, P2: plan steps that cannot be read are a section that could not be read, so
// --mark --html records nothing and the next report's cut does not pass facts this page never showed.
test('--mark --html with plan steps git cannot read says so and records nothing', withProject(async (project) => {
  fs.mkdirSync(project.home, { recursive: true });
  const html = path.join(project.home, 'status.html');
  const recordLoad = async () => ({ renderedFile: () => path.join(project.home, 'rendered.jsonl'), recordRendered: () => ({ sha256: 'e'.repeat(64), bytes: 1 }) });
  const failing = (cmd, args, options) => (args.includes('odd/tasks/') ? { status: 128, stdout: '', stderr: 'fatal: no tree' } : run(cmd, args, options));
  const err = [];
  const code = await reportMain(['--mark', '--html', html, '--cwd', project.repo, '--home', project.home], { stdout: () => {}, stderr: (line) => err.push(line), now: () => NOW, env: {}, recordLoad, run: failing });
  assert.equal(code, 1);
  assert.match(fs.readFileSync(html, 'utf8'), /Los pasos del plan no se pudieron leer: .*no tree/);
  assert.match(err.join('\n'), /not recorded: a section could not be read/);
  assert.deepEqual(readNotices(project.home, project.slug).reports, []);
}));

test('--notes that do not parse are refused before anything is written, and --notes needs --html', withProject(async (project) => {
  const notes = path.join(project.home, 'notes.json');
  fs.mkdirSync(project.home, { recursive: true });
  fs.writeFileSync(notes, '{"badNews":"one"}');
  const html = path.join(project.home, 'status.html');
  const bad = await report(['--html', html, '--notes', notes], project);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /--notes .*notes\.json: badNews is a list of texts/);
  assert.equal(fs.existsSync(html), false);
  const alone = await report(['--notes', notes], project);
  assert.equal(alone.code, 2);
  assert.match(alone.err, /--notes goes with --html/);
}));

// --- the migration and the last stretch (odd/tasks/report-stretch-share.md) ---

const F8_ROADMAP = (s13) => `# Roadmap\n\n## Checklist\n\n### One\n- [x] a\n- [ ] b still open\n\n## F8 plan\n\n### S0 Baseline\n- **State:** done\n\n### S13 Rehearsal\n- **State:** ${s13}\n`;

/** `js-harness stretch` in the project at `ms`, its goals' exits from `goals`. */
async function stretchAt(project, argv, ms, goals = {}) {
  const err = [];
  const code = await stretchMain([...argv, '--home', project.home, '--cwd', project.repo], {}, { cwd: project.repo, stdout: () => {}, stderr: (line) => err.push(line), now: () => ms, readLands: () => [], readCodexRuns: () => [], recordLoad: async () => null, runGoal: async (command) => ({ status: goals[command] ?? 0, stdout: '', stderr: '' }) });
  assert.equal(code, 0, err.join('\n'));
}

// His words of 2026-10-30 (lead transcript 0f71b2c6 line 25223): the "cómo vamos" showed neither the map's
// percentages nor whether the stretch's goals were met. The share and the goals come from the records, not the notes.
test("the status page and the printed report carry the F8 share and the last stretch's goals, from the records", withProject(async (project) => {
  const hour = 3_600_000;
  fs.writeFileSync(path.join(project.repo, 'docs', 'ROADMAP.md'), F8_ROADMAP('to do'));
  git(project.repo, ['commit', '-q', '-am', 'docs: the F8 plan'], '2026-10-20T11:00:00Z');
  await report(['--mark'], project);
  const plan = path.join(project.home, 'plan.json');
  fs.writeFileSync(plan, JSON.stringify({ hours: 2, slots: 1, goals: [{ id: 'G1', text: 'PR 630 en main', command: 'g1' }, { id: 'G2', text: 'S12 empezada', command: 'g2' }], items: [{ id: 'W1', title: 'ensayo', kind: 'build', hours: [1, 1], closes: [{ in: 'F8 plan', step: 'S13' }] }] }));
  await stretchAt(project, ['open', '--plan', plan], NOW + hour / 2);
  fs.writeFileSync(path.join(project.repo, 'docs', 'ROADMAP.md'), F8_ROADMAP('done'));
  git(project.repo, ['commit', '-q', '-am', 'docs: S13 is done'], '2026-10-20T13:00:00Z');
  await stretchAt(project, ['close'], NOW + 2 * hour, { g2: 1 });

  const html = path.join(project.home, 'status.html');
  const recordLoad = async () => ({ renderedFile: () => path.join(project.home, 'rendered.jsonl'), recordRendered: () => ({ sha256: 'e'.repeat(64), bytes: 1 }) });
  const out = [];
  const err = [];
  const code = await reportMain(['--html', html, '--cwd', project.repo, '--home', project.home], { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => NOW + 3 * hour, env: {}, recordLoad });
  assert.equal(code, 0, err.join('\n'));
  const printed = out.join('\n');
  assert.match(printed, /^Migration: F8 plan {2}2\/2 steps {2}100%; at the cut 1\/2 {2}50%$/m);
  assert.match(printed, /^Stretch \S+: closed at 2026-10-20 14:00Z, opened 2026-10-20 12:30Z; 1\.5 of 2 h; goals 1 of 2 met, checked 2026-10-20 14:00Z$/m);
  assert.match(printed, /^ {2}goal G2 not met \(exit 1\): S12 empezada$/m);
  assert.match(printed, /^ {2}forecast F8 plan: 50% at the opening, ~100% at the return \(100% to 100%\); now 100%$/m);
  const four = fs.readFileSync(html, 'utf8').split('4. El mapa')[1].split('5. Lo que espera')[0];
  assert.match(four, /La migración[\s\S]*F8 plan[\s\S]*1 de 2 pasos · 50 %[\s\S]*2 de 2 pasos · 100 %/);
  // odd/tasks/departure-stretch.md, spec 9: the steps at the cut and now, read from git at both commits.
  assert.match(four, /F8 plan, paso por paso[\s\S]*S0[\s\S]*igual[\s\S]*S13[\s\S]*avanzó[\s\S]*El último tramo/);
  assert.match(four, /El último tramo[\s\S]*PR 630 en main[\s\S]*sí[\s\S]*exit 0[\s\S]*S12 empezada[\s\S]*no[\s\S]*exit 1/);
  assert.match(four, /F8 plan[\s\S]*1 de 2 · 50 %[\s\S]*~100 %[\s\S]*2 de 2 · 100 %/);
}));

// Codex review of f2110239..d04fd86c, P2: a stretch measured without one of its records shows partial hours; the report
// says which record, and --mark records nothing, as for any section that could not be read.
test('a record the stretch measure could not read is said, and --mark then records nothing', withProject(async (project) => {
  const plan = path.join(project.home, 'plan.json');
  fs.mkdirSync(project.home, { recursive: true });
  fs.writeFileSync(plan, JSON.stringify({ hours: 2, slots: 1, goals: [{ id: 'G1', text: 'PR 630 en main', command: 'g1' }], items: [{ id: 'W1', title: 'ensayo', kind: 'build', hours: [1, 1] }] }));
  await stretchAt(project, ['open', '--plan', plan], NOW - 3_600_000);
  fs.mkdirSync(path.join(project.repo, '.git', 'js-harness', 'lands.jsonl'), { recursive: true });
  const { code, out, err } = await report(['--mark'], project);
  assert.equal(code, 1);
  assert.match(out, /^ {2}lands could not be read: .*EISDIR.*; the hours above are partial$/m);
  assert.match(err, /not recorded: a section could not be read/);
  assert.deepEqual(readNotices(project.home, project.slug).reports, []);
}));

// The lead sent a report without notes on 2026-10-30, and sections 3, 5 and 6 reached him empty with no warning.
test('--mark --html without --notes warns that sections 3, 5 and 6 will be empty; with notes, or without --mark, it does not', withProject(async (project) => {
  const html = path.join(project.home, 'status.html');
  const notes = path.join(project.home, 'notes.json');
  fs.mkdirSync(project.home, { recursive: true });
  fs.writeFileSync(notes, '{}');
  const recordLoad = async () => ({ renderedFile: () => path.join(project.home, 'rendered.jsonl'), recordRendered: () => ({ sha256: 'e'.repeat(64), bytes: 1 }) });
  const runIt = async (argv) => {
    const err = [];
    const code = await reportMain([...argv, '--cwd', project.repo, '--home', project.home], { stdout: () => {}, stderr: (line) => err.push(line), now: () => NOW, env: {}, recordLoad });
    return { code, err: err.join('\n') };
  };
  const bare = await runIt(['--html', html, '--mark']);
  assert.equal(bare.code, 0, bare.err);
  assert.match(bare.err, /^js-harness report: warning: no --notes, so sections 3, 5 and 6 of the page \(his decisions, what waits, what the lead proposes\) will say no record holds them: pass them with --notes <file>$/m);
  assert.match(fs.readFileSync(html, 'utf8'), /6\. Lo que propongo<\/h2><p class="note">Ningún registro lo guarda/);
  assert.equal((await runIt(['--html', html, '--mark', '--notes', notes])).err, '');
  assert.equal((await runIt(['--html', html])).err, '');
}));
