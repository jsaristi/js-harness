// The summary a finished session leaves (odd/tasks/session-close.md, T1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryMain } from './summary.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SUMMARY_HEADINGS, closeProblems, summaryPath, summaryProblems, summaryTemplate } from './lib/summary.mjs';
import { openingFileName, titleSlug } from './lib/channel.mjs';

const NOW = () => Date.parse('2026-10-17T09:30:00Z');

function call(argv) {
  const out = [];
  const err = [];
  const code = summaryMain(argv, { stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: NOW });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('template prints the summary of the titled session: its title, its file and every heading in order', () => {
  const { code, out, err } = call(['template', '--title', 'JH 24 · gate más rápido']);
  assert.equal(code, 0, err);
  const lines = out.split('\n');
  assert.equal(lines[0], '# JH 24 · gate más rápido');
  assert.match(out, /docs\/sessions\/2026-10-17-jh-24-gate-mas-rapido\.md/);
  const headings = lines.filter((line) => line.startsWith('## ')).map((line) => line.slice(3));
  assert.deepEqual(headings, SUMMARY_HEADINGS);
});

test('path prints only the file of the titled session, dated today in UTC', () => {
  const { code, out } = call(['path', '--title', 'JH 24 · gate más rápido']);
  assert.equal(code, 0);
  assert.equal(out, 'docs/sessions/2026-10-17-jh-24-gate-mas-rapido.md');
});

test('a bad command line is a usage error, exit 2, and prints nothing on standard output', () => {
  for (const argv of [[], ['nope'], ['template'], ['path', '--title'], ['template', '--title', '·· ··'], ['template', '--title', 'a', '--x']]) {
    const { code, out, err } = call(argv);
    assert.equal(code, 2, JSON.stringify(argv));
    assert.equal(out, '', JSON.stringify(argv));
    assert.match(err, /Usage: js-harness summary/, JSON.stringify(argv));
  }
});

test('the title slug is the readable part of the opening file name, so one title gives one name', () => {
  for (const title of ['JH 24 · gate más rápido', 'JH ORQ · js-harness (350k)', 'Ñandú: CON?']) {
    assert.ok(openingFileName(title).startsWith(`${titleSlug(title)}-`), title);
  }
  assert.equal(summaryPath('JH 24 · gate más rápido', NOW()), 'docs/sessions/2026-10-17-jh-24-gate-mas-rapido.md');
});

test('the bare template has every section empty, a filled one has no problem, and a missing heading is named', () => {
  const bare = summaryTemplate('JH 24', NOW());
  assert.deepEqual(summaryProblems(bare), SUMMARY_HEADINGS.map((heading) => `"${heading}" is empty`));
  const filled = bare.replace(/^<.*>$/gm, '- a fact, with its evidence (#379).');
  assert.deepEqual(summaryProblems(filled), []);
  const missing = filled.replace('## Cost\n', '');
  assert.deepEqual(summaryProblems(missing), ['"Cost" is missing']);
});

/** A clone `work` of a bare `origin.git` whose main holds one commit, on a branch `feat/x`, in a temp folder. */
function withClone(body) {
  return () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-summary-'));
    const git = (cwd, ...args) => {
      const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8' });
      assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
      return result.stdout;
    };
    try {
      git(dir, 'init', '-q', '--bare', 'origin.git');
      git(dir, 'clone', '-q', 'origin.git', 'work');
      const work = path.join(dir, 'work');
      git(work, 'checkout', '-q', '-b', 'main');
      fs.writeFileSync(path.join(work, 'README.md'), 'a project\n');
      git(work, 'add', 'README.md');
      git(work, 'commit', '-q', '-m', 'first');
      git(work, 'push', '-q', 'origin', 'main');
      git(work, 'checkout', '-q', '-b', 'feat/x');
      body({ work, git: (...args) => git(work, ...args) });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

const FILE = 'docs/sessions/2026-10-17-jh-24.md';
const filledSummary = () => summaryTemplate('JH 24', NOW()).replace(/^<.*>$/gm, '- a fact, with its evidence (#379).');

test('closeProblems refuses a summary not in the worktree, one with empty sections, one not pushed and one pushed older', withClone(({ work, git }) => {
  assert.match(closeProblems(FILE, work).join(' '), /docs\/sessions\/2026-10-17-jh-24\.md is not in this worktree/);
  fs.mkdirSync(path.join(work, 'docs', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(work, FILE), summaryTemplate('JH 24', NOW()));
  assert.deepEqual(closeProblems(FILE, work), [`${FILE}: ${SUMMARY_HEADINGS.map((heading) => `"${heading}" is empty`).join(', ')}.`]);
  fs.writeFileSync(path.join(work, FILE), filledSummary());
  assert.deepEqual(closeProblems(FILE, work), [`${FILE} is not pushed: neither origin/main nor origin/feat/x holds it; commit it and push.`]);
  git('add', FILE);
  git('commit', '-q', '-m', 'summary');
  assert.deepEqual(closeProblems(FILE, work), [`${FILE} is not pushed: neither origin/main nor origin/feat/x holds it; commit it and push.`]);
  git('push', '-q', 'origin', 'feat/x');
  assert.deepEqual(closeProblems(FILE, work), []);
  fs.appendFileSync(path.join(work, FILE), '- one more fact (#380).\n');
  assert.deepEqual(closeProblems(FILE, work), [`origin/feat/x holds an older copy of ${FILE}: commit and push it as it is now.`]);
}));

test('closeProblems takes a summary main already holds, from a session on main or on any branch', withClone(({ work, git }) => {
  git('checkout', '-q', 'main');
  fs.mkdirSync(path.join(work, 'docs', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(work, FILE), filledSummary());
  git('add', FILE);
  git('commit', '-q', '-m', 'summary');
  assert.deepEqual(closeProblems(FILE, work), [`${FILE} is not pushed: origin/main does not hold it; commit it and push.`]);
  git('push', '-q', 'origin', 'main');
  assert.deepEqual(closeProblems(FILE, work), []);
  git('checkout', '-q', '-b', 'feat/y');
  assert.deepEqual(closeProblems(FILE, work), []);
}));

test('closeProblems outside a git repository says the summary cannot be read as committed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-summary-'));
  try {
    const run = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
    assert.match(closeProblems(FILE, dir, { run }).join(' '), /is not in a git repository, so docs\/sessions\/2026-10-17-jh-24\.md cannot be read as committed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
