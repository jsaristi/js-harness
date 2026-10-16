// The row `rules` of `check` in the harness's own repository (odd/tasks/rule-hierarchy.md, "The row `rules`
// (T16d)"): it reads the lines the staged change adds to the texts in force and reports, or refuses, each line that
// restates a rule's value by its subject, as the rule's stored `row` says.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkOwnRules, main } from './check.mjs';

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rules-row-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

/** A repository of the harness: it holds `bin/lib/rules-data.mjs`, which is what makes the row act, and a few texts
 * in force, committed on `main`. */
function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rules-row-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  write(root, 'bin/lib/rules-data.mjs', 'export const RULES = [];\n');
  write(root, 'AGENTS.md', `${'a'.repeat(400)}\n`);
  write(root, 'docs/ROADMAP.md', '# Roadmap\n');
  write(root, 'odd/tasks/f.md', '# A feature\nIts specs.\n```\nan example\n```\n## Log\nL1 the request\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

function inRepo(run) {
  const root = repo();
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const WAIT = { id: 'gate-wait', subject: 'the wait for a turn of the gate lock', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes', patterns: ['wait.{0,40}{amount}'] };
const CURE = 'write `rule:gate-wait` instead of the value, or change the rule with `js-harness rules change gate-wait`';
const RESTATED = 'The gate may wait 60 minutes.';

test('a restated value of a rule with no row is an INFO line, with its place and its cure', () => inRepo((root) => {
  fs.appendFileSync(path.join(root, 'docs/ROADMAP.md'), `${RESTATED}\nNothing here.\n`);
  git(root, 'add', '.');
  assert.deepEqual(checkOwnRules(root, { rules: [WAIT] }), [{
    name: 'rules',
    pass: true,
    info: true,
    detail: '1 restated value in the lines this change adds, none of a rule that refuses it',
    lines: [`docs/ROADMAP.md:2 restates rule "gate-wait", which reports it: ${RESTATED} (${CURE})`],
  }]);
}));

test('a restated value of a rule that refuses fails the row', () => inRepo((root) => {
  fs.appendFileSync(path.join(root, 'docs/ROADMAP.md'), `${RESTATED}\n`);
  git(root, 'add', '.');
  assert.deepEqual(checkOwnRules(root, { rules: [{ ...WAIT, row: { refuses: '2026-10-16' } }] }), [{
    name: 'rules',
    pass: false,
    detail: '1 restated value in the lines this change adds, 1 of a rule that refuses it',
    lines: [`docs/ROADMAP.md:2 restates rule "gate-wait", which refuses it since 2026-10-16: ${RESTATED} (${CURE})`],
  }]);
}));

test('a rule switched back to report gives an INFO line that names its reason', () => inRepo((root) => {
  fs.appendFileSync(path.join(root, 'docs/ROADMAP.md'), `${RESTATED}\n`);
  git(root, 'add', '.');
  const [row] = checkOwnRules(root, { rules: [{ ...WAIT, row: { reports: 'a wrong pattern', since: '2026-10-16' } }] });
  assert.deepEqual([row.pass, row.info, row.lines], [true, true, [`docs/ROADMAP.md:2 restates rule "gate-wait", which reports it again since 2026-10-16 (a wrong pattern): ${RESTATED} (${CURE})`]]);
}));

test('a line added in a fence, in a history, in a home of the list or in a text not in force is no finding', () => inRepo((root) => {
  const refusing = [{ ...WAIT, row: { refuses: '2026-10-16' } }];
  // The fence was opened, and the history started, by lines already committed: they are read on the whole file.
  fs.writeFileSync(path.join(root, 'odd/tasks/f.md'), `# A feature\nIts specs.\n\`\`\`\n${RESTATED}\nan example\n\`\`\`\n## Log\nL1 the request\nL2 ${RESTATED}\n`);
  write(root, 'docs/RULES.md', `${RESTATED}\n`);
  write(root, 'bin/a.test.mjs', `// ${RESTATED}\n`);
  write(root, 'notes/n.md', `${RESTATED}\n`);
  git(root, 'add', '.');
  assert.deepEqual(checkOwnRules(root, { rules: refusing }), [{
    name: 'rules',
    pass: true,
    info: true,
    detail: '0 restated values in the lines this change adds to the texts in force',
  }]);
  // The same line in a code file is in force.
  write(root, 'bin/a.mjs', `// ${RESTATED}\n`);
  git(root, 'add', '.');
  assert.equal(checkOwnRules(root, { rules: refusing })[0].pass, false);
}));

test('a renamed document adds no line', () => inRepo((root) => {
  write(root, 'odd/tasks/old.md', `# Old\n${RESTATED}\n`);
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'old', '--no-verify');
  git(root, 'mv', 'odd/tasks/old.md', 'odd/tasks/new.md');
  assert.deepEqual(checkOwnRules(root, { rules: [{ ...WAIT, row: { refuses: '2026-10-16' } }] }), []);
}));

test('a merge is refused only for the lines it adds itself, never for those either parent brought', () => inRepo((root) => {
  const refusing = [{ ...WAIT, row: { refuses: '2026-10-16' } }];
  git(root, 'checkout', '-q', '-b', 'feature');
  write(root, 'bin/b.mjs', 'export const B = 1;\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'feature');
  git(root, 'checkout', '-q', 'main');
  fs.appendFileSync(path.join(root, 'docs/ROADMAP.md'), `${RESTATED}\n`);
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'main restated it before the rule refused');
  git(root, 'checkout', '-q', 'feature');
  git(root, 'merge', '-q', '--no-commit', '--no-ff', 'main');
  assert.deepEqual(checkOwnRules(root, { rules: refusing }), [], 'the merge adds no line of its own');
  write(root, 'bin/c.mjs', `// ${RESTATED}\n`);
  git(root, 'add', '.');
  const [row] = checkOwnRules(root, { rules: refusing });
  assert.deepEqual([row.pass, row.lines.map((line) => line.split(' ')[0])], [false, ['bin/c.mjs:1']]);
}));

test('no row with nothing staged, with no rule that carries patterns, or out of a repository of the harness', () => inRepo((root) => {
  assert.deepEqual(checkOwnRules(root, { rules: [WAIT] }), []);
  fs.appendFileSync(path.join(root, 'docs/ROADMAP.md'), `${RESTATED}\n`);
  git(root, 'add', '.');
  const { patterns, ...unscanned } = WAIT;
  assert.deepEqual(checkOwnRules(root, { rules: [unscanned] }), []);
  fs.rmSync(path.join(root, 'bin/lib/rules-data.mjs'));
  git(root, 'add', '.');
  assert.deepEqual(checkOwnRules(root, { rules: [WAIT] }), [], 'a project keeping no list has no row');
}));

test('a gate whose rules row fails stops before its sensors', async () => {
  const root = repo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rules-row-home-'));
  const original = console.log;
  let output = '';
  let sensors = 0;
  try {
    write(root, 'package.json', JSON.stringify({ scripts: { test: 'run-tests' } }));
    fs.appendFileSync(path.join(root, 'docs/ROADMAP.md'), `${RESTATED}\n`);
    git(root, 'add', '.');
    console.log = (line) => {
      output += `${line}\n`;
    };
    const code = await main(['--cwd', root, '--home', home], {}, {
      rules: [{ ...WAIT, row: { refuses: '2026-10-16' } }],
      takeGateLock: async () => {
        throw new Error('not to be asked');
      },
      spawn: () => {
        sensors += 1;
        return { status: 0, stdout: '', stderr: '' };
      },
      sampleLoad: async () => ({ busy: 0.4, processors: 8, share: 0.05, sampleMs: 1000 }),
      busiest: async () => [],
    });
    console.log = original;
    assert.equal(code, 1, output);
    assert.equal(sensors, 0);
    assert.match(output, /^FAIL {2}rules {2}1 restated value in the lines this change adds, 1 of a rule that refuses it$/m);
    assert.match(output, /^FAIL {2}gate {2}no sensor ran: this gate stopped before its sensors, since the row rules fails/m);
  } finally {
    console.log = original;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a git that names the sides of a diff otherwise, and a path with a space or an accent, still give their lines', () => inRepo((root) => {
  git(root, 'config', 'diff.mnemonicPrefix', 'true');
  write(root, 'odd/tasks/a b.md', `# A\n${RESTATED}\n`);
  write(root, 'odd/tasks/café.md', `# B\n${RESTATED}\n`);
  git(root, 'add', '.');
  const [row] = checkOwnRules(root, { rules: [{ ...WAIT, row: { refuses: '2026-10-16' } }] });
  assert.deepEqual(row.lines.map((line) => line.split(' restates')[0]).sort(), ['odd/tasks/a b.md:2', 'odd/tasks/café.md:2']);
}));
