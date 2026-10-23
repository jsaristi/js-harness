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
import { declarationOf, rulesOfText } from './rules-change-run.mjs';
import { projectSlug } from './sessions.mjs';
import { repoTemplate } from './git-fixture.testkit.mjs';

const NOW = Date.parse('2026-10-16T17:00:00.000Z');
// The days the command writes are local days, so the fixtures read them by the clock of the host that runs them.
const localDay = (ms) => { const at = new Date(ms); const two = (n) => String(n).padStart(2, '0'); return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`; };
const TODAY = localDay(NOW);

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

// Most tests ask for one of a few repositories, so each is built once in a run of this file and copied
// (`git-fixture.testkit.mjs`), by the options that make it.
const templates = new Map();

/** A repository with `list` in force on main and origin/main, `files` over the usual ones, on the branch `branch`,
 * and folders for the relief file and the transcripts: `{ dir, home, claude, slug }`. */
function repository({ branch = 'rule/gate-wait', list = LIST, files = {} } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-change-'));
  const dir = path.join(base, 'repo');
  fs.mkdirSync(dir);
  const key = JSON.stringify({ branch, list, files });
  if (!templates.has(key)) templates.set(key, repoTemplate((template) => buildRepository(template, { branch, list, files })));
  templates.get(key)(dir);
  const home = path.join(base, 'home');
  const claude = path.join(base, 'claude');
  return { dir, home, claude, slug: projectSlug(path.resolve(dir)) };
}

/** Builds in `dir` the repository `repository` hands out copies of. */
function buildRepository(dir, { branch, list, files }) {
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  git(dir, 'config', 'core.autocrlf', 'false');
  for (const [file, text] of Object.entries({ ...FILES, ...files })) write(dir, file, text);
  write(dir, 'bin/lib/rules-data.mjs', writeRules(list));
  write(dir, 'docs/rule-sources.json', `${JSON.stringify(SOURCES, null, 2)}\n`);
  write(dir, 'docs/RULES.md', listTextOf(dir, list, SOURCES));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'the list');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(dir, 'switch', '-q', '-c', branch);
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
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /local \(rules change\)\. rule:gate-wait proposed on rule\/gate-wait, not landed: 60 minutes to 30 minutes; source design; supersedes no relief line; declaration and source [0-9a-f]{12}\n$/);
  const held = declarationOf(read(repo.dir, 'bin/lib/rules-data.mjs'), 'gate-wait', JSON.parse(read(repo.dir, 'docs/rule-sources.json')));
  assert.ok(fs.readFileSync(reliefFile(repo), 'utf8').endsWith(`; declaration and source ${held}\n`));
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
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /supersedes relief line 3; declaration and source [0-9a-f]{12}\n$/);
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
  assert.deepEqual(stored, { kind: 'words', quotes: [{ quote: 'treinta minutos', date: localDay(Date.parse('2026-10-15T17:00:00.000Z')), session, line: 1 }], reading: 'thirty minutes', accepted: 'he typed it', checked: { date: TODAY, by: 'command' } });
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

const ruleOf = (repo, id) => rulesOfText(read(repo.dir, 'bin/lib/rules-data.mjs')).find((rule) => rule.id === id);

test('a second id on the same branch keeps the first, and a run again on an id starts from origin/main', async () => {
  const repo = repository();
  assert.equal((await change(repo, ['gate-wait'], { value: 30, source: DESIGN })).code, 0);
  git(repo.dir, 'commit', '-q', '-am', 'gate-wait');
  const second = await change(repo, ['control-phrase-min'], { value: 14, source: DESIGN });
  assert.equal(second.code, 0, second.err);
  assert.deepEqual([ruleOf(repo, 'gate-wait').value, ruleOf(repo, 'gate-wait').was], [30, [{ value: 60, until: TODAY }]]);
  assert.equal(ruleOf(repo, 'control-phrase-min').value, 14);
  git(repo.dir, 'commit', '-q', '-am', 'control-phrase-min');

  const again = await change(repo, ['gate-wait'], { value: 45, source: DESIGN });
  assert.equal(again.code, 0, again.err);
  assert.match(again.out, /60 minutes to 45 minutes/);
  assert.deepEqual(ruleOf(repo, 'gate-wait').was, [{ value: 60, until: TODAY }]);
  assert.equal(ruleOf(repo, 'control-phrase-min').value, 14);
});

test('a split declares its successor on the branch, then retires the rule it splits', async () => {
  const repo = repository();
  const successor = await change(repo, ['gate-wait-short'], { value: 10, unit: 'minutes', set: { subject: 'the short wait for a turn', owner: 'project' }, source: DESIGN });
  assert.equal(successor.code, 0, successor.err);
  git(repo.dir, 'commit', '-q', '-am', 'the successor');
  const retired = await change(repo, ['gate-wait'], { retire: { successors: ['gate-wait-short'] }, source: DESIGN });
  assert.equal(retired.code, 0, retired.err);
  assert.equal(ruleOf(repo, 'gate-wait-short').value, 10);
  assert.deepEqual(ruleOf(repo, 'gate-wait').successors, ['gate-wait-short']);
});

test('a rule/ branch landed by a merge or a squash is no open change, after later changes land too', async () => {
  const repo = repository();
  const landed = (branch, value, squash) => {
    git(repo.dir, 'switch', '-q', '-c', branch, 'origin/main');
    write(repo.dir, 'bin/lib/rules-data.mjs', writeRules(rulesOfText(git(repo.dir, 'show', 'origin/main:bin/lib/rules-data.mjs')).map((rule) => (rule.id === 'gate-wait' ? { ...rule, value } : rule))));
    git(repo.dir, 'commit', '-q', '-am', branch);
    git(repo.dir, 'switch', '-q', 'main');
    if (squash) {
      git(repo.dir, 'merge', '-q', '--squash', branch);
      git(repo.dir, 'commit', '-q', '-m', `squash ${branch}`);
    } else {
      git(repo.dir, 'merge', '-q', '--no-ff', '-m', `merge ${branch}`, branch);
    }
    git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  };
  landed('rule/first', 45, false);
  landed('rule/second', 50, true);
  landed('rule/third', 55, false);
  git(repo.dir, 'switch', '-q', '-c', 'rule/next', 'origin/main');
  const result = await change(repo, ['control-phrase-min', '--dry-run'], { value: 14, source: DESIGN });
  assert.equal(result.code, 0, result.err);
});

test('an open change on origin is refused, and the refusal says how to clear it', async () => {
  const repo = repository();
  git(repo.dir, 'switch', '-q', '-c', 'rule/remote', 'main');
  write(repo.dir, 'bin/lib/rules-data.mjs', writeRules(LIST.map((rule) => (rule.id === 'gate-wait' ? { ...rule, value: 45 } : rule))));
  git(repo.dir, 'commit', '-q', '-am', 'a remote change');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/rule/remote', 'HEAD');
  git(repo.dir, 'switch', '-q', 'rule/gate-wait');
  git(repo.dir, 'branch', '-q', '-D', 'rule/remote');
  const result = await change(repo, ['gate-wait', '--dry-run'], { value: 30, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /origin\/rule\/remote holds a rule change not on origin\/main.*git push origin --delete rule\/remote/s);
});

test('an id in use is refused as a new rule', async () => {
  const repo = repository();
  const result = await change(repo, ['gate-wait'], { value: 20, set: { subject: 'another wait', owner: 'project' }, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /"gate-wait" is in use/);
});

test('a second run before the first is committed says to commit it', async () => {
  const repo = repository();
  assert.equal((await change(repo, ['gate-wait'], { value: 30, source: DESIGN })).code, 0);
  const result = await change(repo, ['control-phrase-min'], { value: 14, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /commit the change already written/);
});

test('a bound is checked against its new value, and AGENTS.md is refused as a new home', async () => {
  const repo = repository();
  const bound = await change(repo, ['control-phrase-min'], { value: 40, source: DESIGN });
  assert.equal(bound.code, 1);
  assert.match(bound.err, /proto-text/);
  const home = await change(repo, ['proto-text'], { path: 'AGENTS.md', phrases: ['He decides spend, anything irreversible'], source: DESIGN });
  assert.equal(home.code, 1);
  assert.match(home.err, /AGENTS.md changes only by its approved draft/);
});

test('a rule of his keeps needing his words when the change also gives it another owner', async () => {
  const repo = repository();
  git(repo.dir, 'switch', '-q', 'main');
  write(repo.dir, 'bin/lib/rules-data.mjs', writeRules(LIST.map((rule) => (rule.id === 'gate-wait' ? { ...rule, owner: 'sebastian' } : rule))));
  git(repo.dir, 'commit', '-q', '-am', 'his rule');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo.dir, 'switch', '-q', '-C', 'rule/gate-wait', 'main');
  const result = await change(repo, ['gate-wait'], { value: 20, set: { owner: 'project' }, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /a rule of his changes only with his words/);
});

test('a relief line that cannot be appended puts the three files back', async () => {
  const repo = repository();
  const before = snapshot(repo);
  write(repo.home, '.js-harness', 'a file where the folder of the relief file goes\n');
  const result = await change(repo, ['gate-wait'], { value: 30, source: DESIGN });
  assert.equal(result.code, 1);
  assert.match(result.err, /are as they were/);
  assert.deepEqual(snapshot(repo), before);
});

test('AGENTS.md is refused however its path is spelled', async () => {
  const repo = repository();
  for (const home of ['./AGENTS.md', 'agents.md', 'docs/../AGENTS.md']) {
    const result = await change(repo, ['agents-rule'], { path: home, phrases: ['He decides spend, anything irreversible'], set: { subject: 'a rule in AGENTS.md', owner: 'project' }, source: DESIGN });
    assert.equal(result.code, 1, home);
    assert.match(result.err, /AGENTS.md changes only by its approved draft/, home);
  }
});

test('a design source is a file inside the repository', async () => {
  const repo = repository();
  write(path.dirname(repo.dir), 'outside.md', '# Outside\n');
  for (const design of ['../outside.md', 'docs']) {
    const result = await change(repo, ['gate-wait'], { value: 30, source: { kind: 'design', path: design } });
    assert.equal(result.code, 1, design);
    assert.match(result.err, /is not a file of the repository/, design);
  }
});

// ---- the keys of the row `rules` (T16d) -------------------------------------------------------------------

const SCANNED = LIST.map((rule) => (rule.id === 'gate-wait' ? { ...rule, patterns: ['wait.{0,40}{amount}'], failure: 'old-rule-beside-new' } : rule));
const REFUSING = SCANNED.map((rule) => (rule.id === 'gate-wait' ? { ...rule, row: { refuses: '2026-10-15' } } : rule));
const REGISTER = '# Failures\n\n## Entries\n\n### old-rule-beside-new\nAn old rule stayed beside the new one.\n- Class: tool\n- Seen: 2026-10-12 — relief file, line 1 — a rule kept twice\n';
const FETCHED = { status: 0, stdout: '', stderr: '' };

/** A `run` for rulesMain that answers `git fetch` with `fetch`, keeping each one asked in `asked`, and runs the rest. */
function fetching(fetch, asked = []) {
  return (command, args, options) => {
    if (command === 'git' && args[0] === 'fetch') {
      asked.push(args.join(' '));
      return fetch;
    }
    return spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true });
  };
}
const rowOf = (repo) => rulesOfText(read(repo.dir, 'bin/lib/rules-data.mjs')).find((rule) => rule.id === 'gate-wait').row;

test('a turn to refuse fetches origin/main first, is refused when the fetch fails, and is written when the count is zero', async () => {
  const repo = repository({ list: SCANNED, files: { 'docs/FAILURES.md': REGISTER } });
  const asked = [];
  const turn = { set: { row: { refuses: TODAY } }, source: DESIGN };
  const failed = await change(repo, ['gate-wait'], turn, { run: fetching({ status: 1, stdout: '', stderr: 'no route' }, asked) });
  assert.equal(failed.code, 1);
  assert.match(failed.err, /^not changed: a turn to refuse counts on origin\/main as it is now, and git fetch origin main failed: no route$/);
  assert.deepEqual(asked, ['fetch origin main']);
  const result = await change(repo, ['gate-wait'], turn, { run: fetching(FETCHED) });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(rowOf(repo), { refuses: TODAY });
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /rule:gate-wait proposed on rule\/gate-wait, not landed: turned to refuse; source design;/);
  assert.match(result.out, /^count: 0 findings of its patterns in origin\/main's texts in force$/m);
});

test('a turn to refuse is refused while origin/main restates the value, and a dry run prints the count', async () => {
  const repo = repository({ list: SCANNED, files: { 'docs/FAILURES.md': REGISTER, 'docs/ROADMAP.md': '# Roadmap\nThe gate may wait 60 minutes.\n' } });
  const before = snapshot(repo);
  const refused = await change(repo, ['gate-wait'], { set: { row: { refuses: TODAY } }, source: DESIGN }, { run: fetching(FETCHED) });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /"gate-wait" has 1 finding in origin\/main's texts in force/);
  assert.deepEqual(snapshot(repo), before);
  const dry = await change(repo, ['gate-wait', '--dry-run'], { set: { patterns: ['gate may wait {amount}'] }, source: DESIGN });
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /^count: 1 finding of its patterns in origin\/main's texts in force$/m);
  assert.deepEqual(snapshot(repo), before);
});

test('a failure is an entry of the register on the branch', async () => {
  const repo = repository({ files: { 'docs/FAILURES.md': REGISTER } });
  const refused = await change(repo, ['gate-wait'], { set: { patterns: ['wait.{0,40}{amount}'], failure: 'no-such-entry' }, source: DESIGN });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /the failure "no-such-entry" names no entry of docs\/FAILURES\.md/);
  const result = await change(repo, ['gate-wait'], { set: { patterns: ['wait.{0,40}{amount}'], failure: 'old-rule-beside-new' }, source: DESIGN });
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /^changed: gate-wait, form;/m);
});

const SCAN_DESIGN = { kind: 'design', path: 'docs/PROTO.md' };
const sourcesOf = (repo) => JSON.parse(read(repo.dir, 'docs/rule-sources.json'));

test('a change of form alone keeps the source of the rule, and its relief line names the design it came from', async () => {
  const repo = repository({ files: { 'docs/FAILURES.md': REGISTER } });
  const form = { set: { patterns: ['wait.{0,40}{amount}'], failure: 'old-rule-beside-new' }, source: SCAN_DESIGN };
  const dry = await change(repo, ['gate-wait', '--dry-run'], form);
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /^Source: kept, the rule's own: \{\n {2}"kind": "design",\n {2}"path": "docs\/ROADMAP\.md"\n\}$/m);
  const result = await change(repo, ['gate-wait'], form);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(sourcesOf(repo), SOURCES);
  const list = rulesOfText(read(repo.dir, 'bin/lib/rules-data.mjs'));
  assert.deepEqual(list.find((rule) => rule.id === 'gate-wait').patterns, ['wait.{0,40}{amount}']);
  assert.equal(read(repo.dir, 'docs/RULES.md'), listTextOf(repo.dir, list, SOURCES));
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /rule:gate-wait proposed on rule\/gate-wait, not landed: form; source design docs\/PROTO\.md, the rule's own source kept; supersedes no relief line; declaration and source [0-9a-f]{12}\n$/);
});

/** A repository on `rule/gate-wait` where gate-wait is his, its value sourced from his words of an earlier day. */
function hisRepository() {
  const repo = repository();
  git(repo.dir, 'switch', '-q', 'main');
  const his = LIST.map((rule) => (rule.id === 'gate-wait' ? { ...rule, owner: 'sebastian' } : rule));
  const valueWords = { kind: 'words', quotes: [{ quote: 'una hora', date: '2026-10-11', session: '11111111-2222-3333-4444-555555555555', line: 1 }], reading: 'an hour', accepted: 'he typed it', checked: { date: '2026-10-11', by: 'command' } };
  const hisSources = { ...SOURCES, 'gate-wait': valueWords };
  write(repo.dir, 'bin/lib/rules-data.mjs', writeRules(his));
  write(repo.dir, 'docs/rule-sources.json', `${JSON.stringify(hisSources, null, 2)}\n`);
  write(repo.dir, 'docs/RULES.md', listTextOf(repo.dir, his, hisSources));
  git(repo.dir, 'commit', '-q', '-am', 'his rule');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo.dir, 'switch', '-q', '-C', 'rule/gate-wait', 'main');
  return { repo, his, hisSources, valueWords };
}

test('a change of form on a rule of his needs no words of his: a design is taken, and his words stay its source', async () => {
  const { repo, valueWords } = hisRepository();
  const form = { set: { patterns: ['wait.{0,40}{amount}'] }, source: SCAN_DESIGN };
  const dry = await change(repo, ['gate-wait', '--dry-run'], form);
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /^Source: kept, the rule's own: \{\n {2}"kind": "words",/m);
  const result = await change(repo, ['gate-wait'], form);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(rulesOfText(read(repo.dir, 'bin/lib/rules-data.mjs')).find((rule) => rule.id === 'gate-wait').patterns, ['wait.{0,40}{amount}']);
  assert.deepEqual(sourcesOf(repo)['gate-wait'], valueWords);
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /rule:gate-wait proposed on rule\/gate-wait, not landed: form; source design docs\/PROTO\.md, the rule's own source kept; supersedes no relief line; declaration and source [0-9a-f]{12}\n$/);
});

test('a value of a rule of his still needs his words: a design is refused for it, alone or beside patterns', async () => {
  const { repo } = hisRepository();
  const before = snapshot(repo);
  for (const given of [{ value: 20, source: SCAN_DESIGN }, { value: 20, set: { patterns: ['wait.{0,40}{amount}'] }, source: SCAN_DESIGN }]) {
    const refused = await change(repo, ['gate-wait'], given);
    assert.equal(refused.code, 1);
    assert.match(refused.err, /a rule of his changes only with his words, not a design, unless the change is of its form alone/);
    assert.deepEqual(snapshot(repo), before);
  }
});

test('patterns removed alone, or a failure set alone, is a change of form too and keeps the source', async () => {
  const repo = repository({ list: SCANNED, files: { 'docs/FAILURES.md': REGISTER } });
  const removed = await change(repo, ['gate-wait'], { set: { patterns: null }, source: SCAN_DESIGN });
  assert.equal(removed.code, 0, removed.err);
  assert.equal(rulesOfText(read(repo.dir, 'bin/lib/rules-data.mjs')).find((rule) => rule.id === 'gate-wait').patterns, undefined);
  assert.deepEqual(sourcesOf(repo), SOURCES);
  git(repo.dir, 'commit', '-q', '-am', 'patterns removed');
  const failure = await change(repo, ['control-phrase-min'], { set: { failure: 'old-rule-beside-new' }, source: SCAN_DESIGN });
  assert.equal(failure.code, 0, failure.err);
  assert.deepEqual(sourcesOf(repo), SOURCES);
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /rule:control-phrase-min proposed on rule\/gate-wait, not landed: form; source design docs\/PROTO\.md, the rule's own source kept;/);
});

test('a change of form on a rule of his, given his words, keeps the rule\'s source and names his words as its own', async () => {
  const repo = repository();
  git(repo.dir, 'switch', '-q', 'main');
  const his = LIST.map((rule) => (rule.id === 'gate-wait' ? { ...rule, owner: 'sebastian' } : rule));
  const session = '11111111-2222-3333-4444-555555555555';
  // The source of his value, his words of an earlier day, as the command stored them.
  const valueWords = { kind: 'words', quotes: [{ quote: 'una hora', date: '2026-10-11', session, line: 1 }], reading: 'an hour', accepted: 'he typed it', checked: { date: '2026-10-11', by: 'command' } };
  const hisSources = { ...SOURCES, 'gate-wait': valueWords };
  write(repo.dir, 'bin/lib/rules-data.mjs', writeRules(his));
  write(repo.dir, 'docs/rule-sources.json', `${JSON.stringify(hisSources, null, 2)}\n`);
  write(repo.dir, 'docs/RULES.md', listTextOf(repo.dir, his, hisSources));
  git(repo.dir, 'commit', '-q', '-am', 'his rule');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo.dir, 'switch', '-q', '-C', 'rule/gate-wait', 'main');
  write(path.join(repo.claude, 'projects', repo.slug), `${session}.jsonl`, `${JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: '2026-10-15T17:00:00.000Z', message: { role: 'user', content: 'Ponele patterns a la espera' } })}\n`);
  const words = { kind: 'words', quotes: [{ session, line: 1, excerpt: 'Ponele patterns' }], reading: 'patterns for the wait', accepted: 'he typed it' };
  const result = await change(repo, ['gate-wait'], { set: { patterns: ['wait.{0,40}{amount}'] }, source: words });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(sourcesOf(repo)['gate-wait'], valueWords);
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /not landed: form; source words, the rule's own source kept;/);
});

test('a value given with patterns is no change of form: the change stores its own source, as before', async () => {
  const repo = repository();
  const result = await change(repo, ['gate-wait'], { value: 30, set: { patterns: ['wait.{0,40}{amount}'] }, source: SCAN_DESIGN });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(sourcesOf(repo)['gate-wait'], SCAN_DESIGN);
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /not landed: 60 minutes to 30 minutes; source design; supersedes/);
});

test('a dry run of a turn to refuse fetches nothing, so no ref moves, and says the count reads the local origin/main', async () => {
  const repo = repository({ list: SCANNED, files: { 'docs/FAILURES.md': REGISTER } });
  const asked = [];
  const before = snapshot(repo);
  const dry = await change(repo, ['gate-wait', '--dry-run'], { set: { row: { refuses: TODAY } }, source: DESIGN }, { run: fetching(FETCHED, asked) });
  assert.equal(dry.code, 0, dry.err);
  assert.deepEqual(asked, [], 'a dry run runs no git fetch');
  assert.match(dry.out, /^not fetched: the count reads origin\/main as this clone holds it; a real change fetches it first$/m);
  assert.deepEqual(snapshot(repo), before);
});

test('a dry run refused for its count also says the count read the local origin/main, not a fetched one', async () => {
  const repo = repository({ list: SCANNED, files: { 'docs/FAILURES.md': REGISTER, 'docs/ROADMAP.md': '# Roadmap\nThe gate may wait 60 minutes.\n' } });
  const asked = [];
  const before = snapshot(repo);
  const dry = await change(repo, ['gate-wait', '--dry-run'], { set: { row: { refuses: TODAY } }, source: DESIGN }, { run: fetching(FETCHED, asked) });
  assert.equal(dry.code, 1);
  assert.match(dry.err, /"gate-wait" has 1 finding in origin\/main's texts in force: .* \(not fetched: the count reads origin\/main as this clone holds it; a real change fetches it first\)/);
  assert.deepEqual([asked, snapshot(repo)], [[], before]);
});

test('the switch back from refuses fetches nothing, writes the reason, and its relief line names the failure', async () => {
  const repo = repository({ list: REFUSING, files: { 'docs/FAILURES.md': REGISTER } });
  const asked = [];
  const refused = await change(repo, ['gate-wait'], { set: { patterns: null }, source: DESIGN }, { run: fetching(FETCHED, asked) });
  assert.match(refused.err, /"gate-wait" refuses since 2026-10-15: its patterns, failure and row change only by the switch back/);
  const result = await change(repo, ['gate-wait'], { set: { row: { reports: 'a wrong pattern', since: TODAY } }, source: DESIGN }, { run: fetching(FETCHED, asked) });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual([rowOf(repo), asked], [{ reports: 'a wrong pattern', since: TODAY }, []]);
  assert.match(fs.readFileSync(reliefFile(repo), 'utf8'), /not landed: switched back to report \(a wrong pattern\), a sighting of failure old-rule-beside-new; source design;/);
});

test('a branch not based on origin/main is said before an input that is not JSON, as before the row keys', async () => {
  const repo = repository();
  git(repo.dir, 'switch', '-q', 'main');
  write(repo.dir, 'docs/ROADMAP.md', '# Roadmap, moved on\n');
  git(repo.dir, 'commit', '-q', '-am', 'main moves on');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo.dir, 'switch', '-q', 'rule/gate-wait');
  const result = await change(repo, ['gate-wait'], undefined, { stdin: () => 'not json' });
  assert.equal(result.code, 1);
  assert.match(result.err, /^not changed: rule\/gate-wait is not based on origin\/main: git merge origin\/main$/);
});

test('the command a branch not based on origin/main is told clears that refusal', async () => {
  const repo = repository();
  git(repo.dir, 'switch', '-q', 'main');
  write(repo.dir, 'docs/ROADMAP.md', '# Roadmap, moved on\n');
  git(repo.dir, 'commit', '-q', '-am', 'main moves on');
  git(repo.dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo.dir, 'switch', '-q', 'rule/gate-wait');
  const told = await change(repo, ['gate-wait'], undefined, { stdin: () => 'not json' });
  const command = told.err.match(/: (git .+)$/)[1].split(' ').slice(1);
  git(repo.dir, ...command, '-q', '--no-edit');
  const result = await change(repo, ['gate-wait'], undefined, { stdin: () => 'not json' });
  assert.equal(result.code, 1);
  assert.doesNotMatch(result.err, /is not based on/);
});

test('a turn to refuse with a pattern that is no regular expression is refused for its pattern, never thrown', async () => {
  const repo = repository({ list: SCANNED, files: { 'docs/FAILURES.md': REGISTER } });
  const before = snapshot(repo);
  const result = await change(repo, ['gate-wait'], { set: { patterns: ['('], row: { refuses: TODAY } }, source: DESIGN }, { run: fetching(FETCHED) });
  assert.equal(result.code, 1);
  assert.match(result.err, /the pattern "\(" is not a regular expression/);
  assert.deepEqual(snapshot(repo), before);
});
