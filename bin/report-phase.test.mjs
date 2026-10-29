import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pagesFile, readPages } from './lib/pages-record.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { reportMain } from './report.mjs';

// odd/tasks/visual-pages.md, "The phase's change": `js-harness report phase` against a repository and a harness home
// of its own in the temp folder. The roadmap is committed twice on main; nothing here reads the real home.

const run = (cmd, args, options) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, ...options });

function git(cwd, args) {
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const result = run('git', ['-c', 'maintenance.auto=false', '-c', 'commit.gpgsign=false', ...args], { cwd, env });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

const ROADMAP = (done) => `# R\n\n## Checklist\n\n### F1 Skeleton\n- [x] a\n- [${done ? 'x' : ' '}] b\n\n### F2 Board\n- [ ] y\n\n## F8 plan\n\n### S0 Base\n- **State:** done.\n\n### S11 Complements\n- **State:** in progress (\`odd/tasks/s11.md\`).\n`;

function project() {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-phase-'));
  const repo = path.join(top, 'repo');
  const home = path.join(top, 'home');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'odd', 'tasks'), { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  const commit = (done, message) => {
    fs.writeFileSync(path.join(repo, 'docs', 'ROADMAP.md'), ROADMAP(done));
    fs.writeFileSync(path.join(repo, 'odd', 'tasks', 's11.md'), `# S11\n\n## Tasks\n- [x] T1\n- [${done ? 'x' : ' '}] T2\n`);
    git(repo, ['add', '.']);
    git(repo, ['commit', '-q', '-m', message]);
    return git(repo, ['rev-parse', 'HEAD']);
  };
  const first = commit(false, 'docs: the roadmap');
  const second = commit(true, 'docs: F1 closes');
  const slug = projectSlug(mainCheckout(run, repo));
  return { top, repo, home, first, second, slug };
}

async function phase(place, args, deps = {}) {
  const out = [];
  const err = [];
  const code = await reportMain(['phase', ...args, '--cwd', place.repo, '--home', place.home], { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => Date.parse('2026-10-29T04:00:00Z'), recordLoad: async () => null, ...deps });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('report phase with no before writes the whole map now, says it has no before, and records the page', async (t) => {
  const place = project();
  t.after(() => fs.rmSync(place.top, { recursive: true, force: true }));
  const html = path.join(place.top, 'phase.html');
  const result = await phase(place, ['--html', html, '--record']);
  assert.equal(result.code, 0, result.err);
  const page = fs.readFileSync(html, 'utf8');
  assert.match(page, /^<title>Cambio de fase<\/title>/);
  assert.match(page, /Esta vez no hay un antes/);
  assert.match(page, /F1 Skeleton[\s\S]*2\/2 · 100 %/);
  const last = readPages(pagesFile(place.home, place.slug)).at(-1);
  assert.equal(last.kind, 'phase');
  assert.equal(last.subject, 'map');
  assert.equal(last.head, place.second);
  assert.deepEqual(last.numbers.map, { done: 2, total: 3 });
  assert.match(result.out, /not in the rendered record/, 'the rendered record not built yet is said');
});

test('the next phase page compares with the commit the last one read, and --since names another', async (t) => {
  const place = project();
  t.after(() => fs.rmSync(place.top, { recursive: true, force: true }));
  const since = JSON.parse((await phase(place, ['--since', place.first, '--json'])).out);
  assert.deepEqual(since.head, { before: place.first, now: place.second, since: place.first });
  assert.deepEqual(since.closed, ['F1 Skeleton']);
  assert.equal(since.plans[0].steps.find((one) => one.id === 'S11').change, 'advanced');
  assert.deepEqual(since.next.step, { plan: 'F8 plan', id: 'S11', title: 'S11 Complements', said: 'in progress (`odd/tasks/s11.md`).' });

  fs.mkdirSync(path.dirname(pagesFile(place.home, place.slug)), { recursive: true });
  fs.writeFileSync(pagesFile(place.home, place.slug), `${JSON.stringify({ schema: 'js-harness.page/v1', kind: 'phase', subject: 'map', at: '2026-10-28T00:00:00Z', head: place.first, numbers: {} })}\n`);
  const fromRecord = JSON.parse((await phase(place, ['--json'])).out);
  assert.deepEqual(fromRecord.head, { before: place.first, now: place.second, since: 'record' });
  assert.deepEqual(fromRecord.closed, ['F1 Skeleton']);
});

test('a page written is recorded once in the rendered record, and a before git cannot read is said, never compared', async (t) => {
  const place = project();
  t.after(() => fs.rmSync(place.top, { recursive: true, force: true }));
  const calls = [];
  const recordLoad = async () => ({ renderedFile: () => path.join(place.top, 'rendered.jsonl'), recordRendered: (file, entry) => { calls.push(entry); return { sha256: 'f'.repeat(64), bytes: 1 }; } });
  const html = path.join(place.top, 'p.html');
  const result = await phase(place, ['--since', 'deadbeef', '--html', html], { recordLoad });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(calls, [{ template: 'phase-change', subject: 'map', path: html, at: '2026-10-29T04:00:00.000Z', head: place.second }]);
  assert.match(fs.readFileSync(html, 'utf8'), /git no pudo leer deadbeef/);
  assert.match(result.out, /rendered record/);
  assert.deepEqual(calls.length, 1);
  const none = await phase(place, ['--json'], { recordLoad });
  assert.equal(none.code, 0);
  assert.equal(calls.length, 1, 'no page written, nothing recorded');
});

test('report phase refuses an unknown flag with the usage, and a default branch with no roadmap with why', async (t) => {
  const place = project();
  t.after(() => fs.rmSync(place.top, { recursive: true, force: true }));
  const bad = await phase(place, ['--nope']);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /unknown argument: --nope[\s\S]*report phase/);
  fs.rmSync(path.join(place.repo, 'docs', 'ROADMAP.md'));
  git(place.repo, ['commit', '-q', '-am', 'docs: no roadmap']);
  const gone = await phase(place, ['--json']);
  assert.equal(gone.code, 1);
  assert.match(gone.err, /the roadmap at the default branch could not be read/);
});
