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
