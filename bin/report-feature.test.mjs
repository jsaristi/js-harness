import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pagesFile, readPages } from './lib/pages-record.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { reportMain } from './report.mjs';

// odd/tasks/visual-pages.md, "The feature's close": `js-harness report feature <doc>` against a repository and a
// harness home of its own in the temp folder. A feature branch lands on main through a merge named as a pull request,
// and its commit has a Codex review record; nothing here reads the real home.

const run = (cmd, args, options) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, ...options });

function git(cwd, args, date = '2026-10-29T01:00:00Z') {
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  const result = run('git', ['-c', 'maintenance.auto=false', '-c', 'commit.gpgsign=false', ...args], { cwd, env });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

const ROADMAP = (done) => `# R\n\n## Checklist\n\n### F1 Skeleton\n- [x] a\n- [${done ? 'x' : ' '}] b\n`;
const DOC = '# feature-x\n\nBranch `feat/x`, from main. Session JH 9.\n\n## Done when\n- `npm run check` exits 0.\n\n## Specs\n1. The page.\n\n## Tasks\n- [x] T1 (kind: build) the page.\n';

function project() {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-feature-'));
  const repo = path.join(top, 'repo');
  const home = path.join(top, 'home');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'odd', 'tasks'), { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  fs.writeFileSync(path.join(repo, 'docs', 'ROADMAP.md'), ROADMAP(false));
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'docs: the roadmap'], '2026-10-29T00:00:00Z');
  git(repo, ['checkout', '-q', '-b', 'feat/x']);
  fs.writeFileSync(path.join(repo, 'docs', 'ROADMAP.md'), ROADMAP(true));
  fs.writeFileSync(path.join(repo, 'odd', 'tasks', 'feature-x.md'), DOC);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'feat: the page'], '2026-10-29T01:00:00Z');
  const work = git(repo, ['rev-parse', 'HEAD']);
  git(repo, ['checkout', '-q', 'main']);
  git(repo, ['merge', '-q', '--no-ff', '-m', 'Merge pull request #7 from feat/x', 'feat/x'], '2026-10-29T03:30:00Z');
  const merge = git(repo, ['rev-parse', 'HEAD']);
  const records = path.join(repo, '.git', 'js-harness');
  fs.mkdirSync(records, { recursive: true });
  fs.writeFileSync(path.join(records, 'codex-reviews.jsonl'), `${JSON.stringify({ schema: 'js-harness.codex-review/v1', base: 'x', head: work, reviewedAt: '2026-10-29T02:00:00Z', outcome: 'reviewed', run: 'r1' })}\n`);
  fs.writeFileSync(path.join(records, 'codex-review-runs.jsonl'), `${JSON.stringify({ id: 'r1', head: work, usage: { inputTokens: 1200, cachedInputTokens: 200 }, verdict: 'correct' })}\n`);
  const slug = projectSlug(mainCheckout(run, repo));
  return { top, repo, home, work, merge, slug };
}

async function feature(place, args, deps = {}) {
  const out = [];
  const err = [];
  const code = await reportMain(['feature', ...args, '--cwd', place.repo, '--home', place.home], { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => Date.parse('2026-10-29T04:00:00Z'), recordLoad: async () => null, ...deps });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('report feature writes the close of a feature from its document, git and the records, and records the page', async (t) => {
  const place = project();
  t.after(() => fs.rmSync(place.top, { recursive: true, force: true }));
  const html = path.join(place.top, 'feature.html');
  const calls = [];
  const recordLoad = async () => ({ renderedFile: () => path.join(place.home, 'rendered.jsonl'), recordRendered: (file, entry) => { calls.push(entry); return { sha256: 'f'.repeat(64), bytes: 1 }; } });
  const result = await feature(place, ['odd/tasks/feature-x.md', '--html', html, '--record'], { recordLoad });
  assert.equal(result.code, 0, result.err);
  const page = fs.readFileSync(html, 'utf8');
  assert.match(page, /^<title>Cierre de feature-x<\/title>/);
  assert.match(page, /1\. The page\./);
  assert.match(page, /PR 7 · feat\/x/);
  assert.match(page, /2\.5 h reales[\s\S]*sin estimado registrado/);
  assert.match(page, /1 de 1 commits son el final de una revisión de Codex/);
  assert.match(page, /Codex: 1\.200 tokens de entrada, 200 en caché\./);
  assert.match(page, /F1 Skeleton[\s\S]*1\/2[\s\S]*2\/2 · 100 %/);
  assert.deepEqual(calls, [{ template: 'feature-close', subject: 'odd/tasks/feature-x.md', path: html, at: '2026-10-29T04:00:00.000Z', head: place.merge }]);
  const last = readPages(pagesFile(place.home, place.slug)).at(-1);
  assert.equal(last.kind, 'feature');
  assert.equal(last.subject, 'odd/tasks/feature-x.md');
  assert.equal(last.head, place.merge);
  assert.equal(last.numbers.prs, 1);
  assert.match(result.out, /PR 7/);
});

test('a feature no merge names says its pull requests are unknown, and --pr names one the document does not', async (t) => {
  const place = project();
  t.after(() => fs.rmSync(place.top, { recursive: true, force: true }));
  fs.writeFileSync(path.join(place.repo, 'odd', 'tasks', 'other.md'), '# other\n\nBranch `feat/other`.\n');
  const unknown = await feature(place, ['odd/tasks/other.md', '--json']);
  assert.equal(unknown.code, 0, unknown.err);
  assert.match(JSON.parse(unknown.out).prs.unknown, /none of them is of feat\/other/);
  const named = await feature(place, ['odd/tasks/other.md', '--pr', '7', '--json']);
  assert.deepEqual(JSON.parse(named.out).prs.map((pr) => pr.number), [7]);
});

test('report feature needs a readable document, and refuses a bad --pr', async (t) => {
  const place = project();
  t.after(() => fs.rmSync(place.top, { recursive: true, force: true }));
  const none = await feature(place, []);
  assert.equal(none.code, 2);
  assert.match(none.err, /report feature needs the feature document/);
  const missing = await feature(place, ['odd/tasks/nope.md']);
  assert.equal(missing.code, 1);
  assert.match(missing.err, /the feature document .*nope\.md could not be read: ENOENT/);
  const bad = await feature(place, ['odd/tasks/feature-x.md', '--pr', 'seven']);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /--pr takes a pull request number/);
});
