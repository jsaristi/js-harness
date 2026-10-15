// `js-harness rules change`, run on a repository made in each test: its own rules, sources and list, an origin/main,
// and a relief file and transcripts under folders of the test. Nothing reads the real relief file or transcripts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rulesMain } from '../rules.mjs';
import { checkRules } from './rules-check.mjs';
import { renderList, writeRules } from './rules.mjs';
import { rulesOfText } from './rules-change-run.mjs';
import { projectSlug } from './sessions.mjs';

const NOW = Date.parse('2026-10-16T17:00:00.000Z');
const TODAY = '2026-10-16';

const LIST = [
  { id: 'control-phrase-min', subject: 'the shortest phrase of a control', owner: 'project', since: '2026-10-01', value: 12, unit: 'characters' },
  { id: 'gate-wait', subject: 'the wait for a turn of the gate lock', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes', flag: '--wait' },
  { id: 'proto-text', subject: 'a protocol in prose', owner: 'project', since: '2026-10-11', path: 'docs/PROTO.md', phrases: ['A protocol phrase long enough'] },
  { id: 'who-decides', subject: 'what is his to decide', owner: 'project', since: '2026-10-11', path: 'AGENTS.md', phrases: ['He decides spend, anything irreversible'] },
];
const DESIGN = { kind: 'design', path: 'docs/ROADMAP.md' };
const SOURCES = Object.fromEntries(LIST.map((rule) => [rule.id, DESIGN]));
const FILES = {
  'docs/ROADMAP.md': '# Roadmap\n',
  'docs/PROTO.md': 'A protocol phrase long enough to be found.\n',
  'AGENTS.md': 'He decides spend, anything irreversible and product choices.\n',
  'bin/x.mjs': 'export const x = 1;\n',
};

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};
const write = (dir, file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');

/** The text of docs/RULES.md for `list` and `sources` in the repository `dir`, as `rules render` gives it. */
function listTextOf(dir, list, sources) {
  const files = (prefix) => Object.keys(FILES).filter((file) => file.startsWith(prefix)).map((file) => ({ path: file, text: read(dir, file) }));
  const result = checkRules({ rules: list, sources, dataText: writeRules(list), listText: null, codeFiles: files('bin/'), textFiles: [], readFile: (file) => (fs.existsSync(path.join(dir, file)) ? read(dir, file) : null) });
  return renderList(list, { sources, readers: result.readers, sentences: result.sentences });
}

/** A repository with the list in force on main and origin/main, on the branch `branch`, and folders for the relief
 * file and the transcripts: `{ dir, home, claude, slug }`. */
function repository({ branch = 'rule/gate-wait' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-change-'));
  const dir = path.join(base, 'repo');
  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  git(dir, 'config', 'core.autocrlf', 'false');
  for (const [file, text] of Object.entries(FILES)) write(dir, file, text);
  write(dir, 'bin/lib/rules-data.mjs', writeRules(LIST));
  write(dir, 'docs/rule-sources.json', `${JSON.stringify(SOURCES, null, 2)}\n`);
  write(dir, 'docs/RULES.md', listTextOf(dir, LIST, SOURCES));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'the list');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(dir, 'switch', '-q', '-c', branch);
  const home = path.join(base, 'home');
  const claude = path.join(base, 'claude');
  return { dir, home, claude, slug: projectSlug(path.resolve(dir)) };
}

/** Runs `rules change` in `repo` with `change` on standard input: `{ code, out, err }`. */
async function change(repo, argv, change, options = {}) {
  const out = [];
  const err = [];
  const code = await rulesMain(['change', ...argv], {
    root: repo.dir,
    cwd: repo.dir,
    env: { JS_HARNESS_HOME: repo.home, CLAUDE_CONFIG_DIR: repo.claude },
    now: () => NOW,
    stdin: () => (change === undefined ? '' : JSON.stringify(change)),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    ...options,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const reliefFile = (repo) => path.join(repo.home, '.js-harness', 'relief', `${repo.slug}.md`);
const snapshot = (repo) => ['bin/lib/rules-data.mjs', 'docs/rule-sources.json', 'docs/RULES.md'].map((file) => read(repo.dir, file));

test('a new value writes the declaration, the source and the list, and appends the relief line', async () => {
  const repo = repository();
  const result = await change(repo, ['gate-wait'], { value: 30, source: DESIGN });
  assert.equal(result.code, 0, result.err);
  const list = rulesOfText(read(repo.dir, 'bin/lib/rules-data.mjs'));
  assert.deepEqual(list.find((rule) => rule.id === 'gate-wait').was, [{ value: 60, until: TODAY }]);
  assert.equal(read(repo.dir, 'docs/RULES.md'), listTextOf(repo.dir, list, SOURCES));
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /local \(rules change\)\. rule:gate-wait proposed on rule\/gate-wait, not landed: 60 minutes to 30 minutes; source design; supersedes no relief line\n$/);
  assert.match(result.out, /memory: .*60 minutes.*rule:gate-wait/);
  assert.match(result.out, /cost: one gate, gentle-ai's assessment and a small Codex review/);
});

test('--dry-run prints the change and writes nothing', async () => {
  const repo = repository();
  const before = snapshot(repo);
  const result = await change(repo, ['gate-wait', '--dry-run'], { value: 30, source: DESIGN });
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /"value": 30/);
  assert.match(result.out, /rule:gate-wait proposed on rule\/gate-wait/);
  assert.deepEqual(snapshot(repo), before);
  assert.equal(fs.existsSync(reliefFile(repo)), false);
});

test('it runs only on a rule/ branch based on origin/main', async () => {
  const repo = repository({ branch: 'feat/other' });
  const before = snapshot(repo);
  const result = await change(repo, ['gate-wait'], { value: 30, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /runs on a branch rule\/<name>.*git switch -c rule\/gate-wait origin\/main/s);
  assert.deepEqual(snapshot(repo), before);
});

test('another rule/ branch whose data differs is an open change, and a landed one with a later commit is not', async () => {
  const repo = repository();
  git(repo.dir, 'switch', '-q', '-c', 'rule/landed', 'main');
  write(repo.dir, 'docs/ROADMAP.md', '# Roadmap, ticked after the merge\n');
  git(repo.dir, 'commit', '-q', '-am', 'a tick after the merge');
  git(repo.dir, 'switch', '-q', 'rule/gate-wait');
  assert.equal((await change(repo, ['gate-wait', '--dry-run'], { value: 30, source: DESIGN })).code, 0);

  git(repo.dir, 'switch', '-q', '-c', 'rule/other', 'main');
  write(repo.dir, 'bin/lib/rules-data.mjs', writeRules(LIST.map((rule) => (rule.id === 'gate-wait' ? { ...rule, value: 45 } : rule))));
  git(repo.dir, 'commit', '-q', '-am', 'another change');
  git(repo.dir, 'switch', '-q', 'rule/gate-wait');
  const result = await change(repo, ['gate-wait', '--dry-run'], { value: 30, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /rule\/other holds a rule change not on origin\/main/);
});

test('a change outside the rule\'s home in the tree is refused, and the home of a text change is accepted', async () => {
  const repo = repository();
  write(repo.dir, 'bin/x.mjs', 'export const x = 2;\n');
  const refused = await change(repo, ['gate-wait'], { value: 30, source: DESIGN });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /bin\/x.mjs/);
  git(repo.dir, 'checkout', '--', 'bin/x.mjs');

  write(repo.dir, 'docs/PROTO.md', 'A protocol phrase rewritten at length.\n');
  const accepted = await change(repo, ['proto-text'], { path: 'docs/PROTO.md', phrases: ['A protocol phrase rewritten'], source: DESIGN });
  assert.equal(accepted.code, 0, accepted.err);
});

test('a retirement while code reads the rule is refused, naming the reader', async () => {
  const repo = repository();
  git(repo.dir, 'switch', '-q', 'main');
  write(repo.dir, 'bin/x.mjs', "import { ruleValue } from './lib/rules.mjs';\nexport const x = ruleValue(\"gate-wait\", 'minutes');\n");
  git(repo.dir, 'commit', '-q', '-am', 'a reader');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo.dir, 'switch', '-q', '-C', 'rule/gate-wait', 'main');
  const result = await change(repo, ['gate-wait'], { retire: { successors: [] }, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /bin\/x.mjs: reads rule "gate-wait"/);
});

test('a rule whose home is AGENTS.md is refused until its draft exists', async () => {
  const repo = repository();
  const result = await change(repo, ['who-decides'], { set: { subject: 'what he decides' }, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /AGENTS.md changes only by its approved draft/);
});

test('the relief line names the last line the command wrote for the id, blank lines counted, and no longer id', async () => {
  const repo = repository();
  fs.mkdirSync(path.dirname(reliefFile(repo)), { recursive: true });
  fs.writeFileSync(reliefFile(repo), [
    'a line', '', 'x local (rules change). rule:gate-wait proposed on rule/a, not landed: 45 minutes to 60 minutes; source design; supersedes no relief line',
    '', 'x local (rules change). rule:gate-wait-max proposed on rule/b, not landed: new; source design; supersedes no relief line', '',
  ].join('\n'));
  const result = await change(repo, ['gate-wait'], { value: 30, source: DESIGN });
  assert.equal(result.code, 0, result.err);
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /supersedes relief line 3\n$/);
});

test('it refuses a root that is not the code that runs', async () => {
  const repo = repository();
  const result = await change(repo, ['gate-wait'], { value: 30, source: DESIGN }, { root: path.join(repo.dir, '..') });
  assert.equal(result.code, 1);
  assert.match(result.err, /runs from the checkout it changes/);
});

test('his words are read from the transcript and stored with a check by the command; --check-source checks a stored source', async () => {
  const repo = repository();
  const session = '11111111-2222-3333-4444-555555555555';
  write(path.join(repo.claude, 'projects', repo.slug), `${session}.jsonl`, `${JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: '2026-10-15T17:00:00.000Z', message: { role: 'user', content: 'La espera queda en treinta minutos' } })}\n`);
  const source = { kind: 'words', quotes: [{ session, line: 1, excerpt: 'treinta minutos' }], reading: 'thirty minutes', accepted: 'he typed it' };
  const result = await change(repo, ['gate-wait'], { value: 30, source });
  assert.equal(result.code, 0, result.err);
  const stored = JSON.parse(read(repo.dir, 'docs/rule-sources.json'))['gate-wait'];
  assert.deepEqual(stored, { kind: 'words', quotes: [{ quote: 'treinta minutos', date: '2026-10-15', session, line: 1 }], reading: 'thirty minutes', accepted: 'he typed it', checked: { date: TODAY, by: 'command' } });
  git(repo.dir, 'commit', '-q', '-am', 'the change');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo.dir, 'switch', '-q', '-c', 'rule/check');
  const checked = await change(repo, ['gate-wait', '--check-source']);
  assert.equal(checked.code, 0, checked.err);
  assert.match(checked.out, /source checked/);
});

test('a failed rename puts the three files back and appends nothing', async () => {
  const repo = repository();
  const before = snapshot(repo);
  let calls = 0;
  const rename = (from, to) => {
    calls += 1;
    if (calls === 2) throw Object.assign(new Error('busy'), { code: 'EPERM' });
    fs.renameSync(from, to);
  };
  const result = await change(repo, ['gate-wait'], { value: 30, source: DESIGN }, { rename });
  assert.equal(result.code, 1);
  assert.match(result.err, /EPERM/);
  assert.deepEqual(snapshot(repo), before);
  assert.equal(fs.existsSync(reliefFile(repo)), false);
});

test('in a project that installs the harness the change is refused: its list is edited by hand', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-change-project-'));
  git(dir, 'init', '-q', '-b', 'main');
  const err = [];
  const code = await rulesMain(['change', 'gate-wait'], { cwd: dir, stdin: () => '{}', stdout: () => {}, stderr: (line) => err.push(line) });
  assert.equal(code, 1);
  assert.match(err.join('\n'), /docs\/rules.json is edited by hand/);
});

test('a change of the input that is not JSON, or no id, is refused', async () => {
  const repo = repository();
  const out = [];
  const err = [];
  const code = await rulesMain(['change', 'gate-wait'], { root: repo.dir, cwd: repo.dir, env: { JS_HARNESS_HOME: repo.home }, now: () => NOW, stdin: () => 'not json', stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  assert.equal(code, 1);
  assert.match(err.join('\n'), /not JSON/);
  assert.equal(await rulesMain(['change'], { root: repo.dir, cwd: repo.dir, stdout: () => {}, stderr: () => {} }), 2);
});
