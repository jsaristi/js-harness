// Tests of scripts/audit-flags.mjs (odd/tasks/launch-audit.md, S5b): the pure functions on small inputs, and the CLI on
// a fixture repository in the temp folder. The fixture holds a fake dispatcher with two commands: alpha, which refuses
// what it does not know, and beta, which exits 0 whatever it is given. Nothing is written inside the worktree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyAllow,
  audit as auditFlags,
  classifyProbe,
  commandSections,
  commandsFromHelp,
  entryFiles,
  flagsOnLine,
  isolated,
  markdownLines,
  parserFlags,
  probesOf,
  subcommandFlags,
  subWords,
} from './audit-flags.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'audit-flags.mjs');

const ALPHA = `const USAGE = [
  'Usage: js-harness alpha [--to <n>] [--fast] [--pm npm|pnpm] [--home=<path>] [--ghost]',
  '       js-harness alpha run [--deep]',
  '',
  'Alpha does the first thing.',
].join('\\n');
export async function alphaMain(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(USAGE);
    return 0;
  }
  const sub = args[0] === 'run';
  const rest = sub ? args.slice(1) : args;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--deep' && sub) continue;
    if (arg === '--fast' || arg === '--secret') continue;
    if (arg === '--to' || arg === '--pm') {
      index += 1;
      continue;
    }
    if (arg.startsWith('--home=')) continue;
    console.error('unknown argument: ' + arg);
    return 2;
  }
  return 0;
}
`;

const BETA = `const USAGE = [
  'Usage: js-harness beta [--ignored]',
  '',
  'Beta takes anything and does nothing.',
].join('\\n');
export async function betaMain(args) {
  if (args.length === 1 && args[0] === '--help') console.log(USAGE);
  return 0;
}
`;

const DISPATCHER = `#!/usr/bin/env node
const USAGE = [
  'Usage: js-harness <command>',
  '',
  'Commands:',
  '  alpha       The strict command.',
  '  beta        The command that takes anything.',
].join('\\n');
const COMMANDS = {
  alpha: async () => (await import('./alpha.mjs')).alphaMain,
  beta: async () => (await import('./beta.mjs')).betaMain,
};
const [command, ...rest] = process.argv.slice(2);
if (!command || command === '--help') {
  console.log(USAGE);
} else if (Object.hasOwn(COMMANDS, command)) {
  process.exitCode = await (await COMMANDS[command]())(rest);
} else {
  console.error('Unknown command: ' + command);
  process.exitCode = 2;
}
`;

// Line 3 of the SPEC names alpha's flag `--ghost`, which its parser does not take.
const README = [
  '# fake',
  '',
  '## Install',
  '',
  'Install it.',
  '',
  '## Commands',
  '',
  '### js-harness alpha',
  '',
  '```sh',
  'js-harness alpha --to 5 --fast',
  '```',
  '',
  'Alpha also takes `js-harness alpha run --deep`.',
  '',
  '### js-harness beta',
  '',
  '```sh',
  'js-harness beta',
  '```',
  '',
].join('\n');

const SPEC = ['# fake spec', '', 'The alpha command reads `js-harness alpha --ghost` as its first flag.', ''].join('\n');

function fixture(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-flags-test-'));
  const all = {
    'bin/js-harness.mjs': DISPATCHER,
    'bin/alpha.mjs': ALPHA,
    'bin/beta.mjs': BETA,
    'README.md': README,
    'docs/SPEC.md': SPEC,
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

function audit(dir, extra = []) {
  return spawnSync(process.execPath, [SCRIPT, '--cwd', dir, ...extra], { encoding: 'utf8', timeout: 240000 });
}

function withFixture(files, body) {
  const dir = fixture(files);
  try {
    return body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function lineOf(text, needle) {
  return text.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

// The findings of the fixture without an allow-list, in the order a run prints them: the probes of the documented flags,
// then the parser literals. alpha's --ghost is named by help and by SPEC, and not taken; beta's --ignored is probed,
// and beta exits 0; alpha's --secret is taken but not named.
const BASE = [
  { kind: 'not-accepted', location: 'alpha --ghost', detail: 'help, SPEC:3' },
  { kind: 'unprobed', location: 'beta --ignored', detail: 'exit 0, no output' },
  { kind: 'undocumented', location: 'alpha --secret', detail: `bin/alpha.mjs:${lineOf(ALPHA, "'--secret'")}` },
];

test('a flag shown with a value takes one, a placeholder sub word reads as x, and a flag with no place is bare', () => {
  const found = flagsOnLine('js-harness rules change <id> --dry-run --pm npm|pnpm --home=<path> --day YYYY-MM-DD --fast', null, ['rules']);
  assert.deepEqual(found.map(({ flag, sub, value }) => [flag, sub, value]), [
    ['--dry-run', ['change', 'x'], 'none'],
    ['--pm', ['change', 'x'], 'space'],
    ['--home', ['change', 'x'], 'eq'],
    ['--day', ['change', 'x'], 'space'],
    ['--fast', ['change', 'x'], 'none'],
  ]);
  assert.deepEqual(flagsOnLine('Run it with --first <reason> now.', 'check', ['check']).map(({ command, sub, flag, value }) => [command, sub, flag, value]), [
    ['check', [], '--first', 'space'],
  ]);
});

test('a flag after the last alternative of a usage belongs to it, and a bare name right before a flag names that command', () => {
  const commands = ['contract', 'sessions', 'stack'];
  const usage = flagsOnLine('Usage: js-harness contract template | check [file...] [--cwd <dir>] | run <file> [--timeout <minutes>]', null, commands);
  assert.deepEqual(usage.map(({ command, sub, flag }) => [command, sub, flag]), [
    ['contract', ['check'], '--cwd'],
    ['contract', ['run', 'x'], '--timeout'],
  ]);
  const prose = flagsOnLine('Read it as sessions --address gives it, and js-harness stack install [--tool <id>]', null, commands);
  assert.deepEqual(prose.map(({ command, sub, flag }) => [command, sub, flag]), [
    ['sessions', [], '--address'],
    ['stack', ['install'], '--tool'],
  ]);
  // A command named inside parentheses names nothing past its closing one: --every is the wait's.
  const example = flagsOnLine('of a lease (js-harness permit lease) and --every plus 5 minutes', 'wait', ['permit', 'wait']);
  assert.deepEqual(example.map(({ command, sub, flag }) => [command, sub, flag]), [['wait', [], '--every']]);
});

test('a bare probe of a flag that another place names under a sub word joins that probe', () => {
  const probes = probesOf([
    { command: 'stack', sub: [], flag: '--tool', value: 'none', place: 'help' },
    { command: 'stack', sub: ['install'], flag: '--tool', value: 'space', place: 'help' },
  ]);
  assert.deepEqual(probes, [{ command: 'stack', sub: ['install'], flag: '--tool', value: 'space', places: ['help'] }]);
});

test('sub words are the plain words of a usage place, never prose or brackets', () => {
  assert.deepEqual(subWords(['run']), ['run']);
  assert.deepEqual(subWords(['first', '[']), ['first']);
  assert.deepEqual(subWords(['profile', '[<kind>[,<kind>]]']), ['profile']);
  assert.deepEqual(subWords(['[']), []);
  assert.deepEqual(subWords(['change', '<id>', 'is', 'the']), ['change', 'x']);
  assert.deepEqual(subWords(['reviewed', '(']), ['reviewed']);
});

test('the parser literals are the case labels, comparisons, startsWith prefixes and known-flag lists, not other programs\' arguments', () => {
  const source = [
    'switch (arg) {',
    "  case '--alpha': break;",
    '}',
    "if (arg === '--beta') continue;",
    "if ('--gamma' !== arg) continue;",
    "if (arg.startsWith('--delta=')) continue;",
    "const KNOWN = new Set(['--epsilon', '--zeta']);",
    "spawnSync('git', ['--no-pager', 'log']);",
    "parseArgs(argv, ['--eta']);",
    "const named = (ref) => Boolean(git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]));",
    "const states = IDS.map((id) => probe(id, ['--version']));",
    "const listed = JSON.parse(answer(run, 'gh', ['pr', 'list', '--state', 'open']));",
  ].join('\n');
  assert.deepEqual(parserFlags(source), [
    { flag: '--alpha', line: 2 },
    { flag: '--beta', line: 4 },
    { flag: '--gamma', line: 5 },
    { flag: '--delta', line: 6 },
    { flag: '--epsilon', line: 7 },
    { flag: '--zeta', line: 7 },
    { flag: '--eta', line: 9 },
  ]);
});

test('an entry file is the last module a command imports, so rules reads rules.mjs and sync reads install.mjs', () => {
  const dispatcher = [
    'const COMMANDS = {',
    "  check: async () => (await import('./check.mjs')).main,",
    "  sync: async () => (await import('./install.mjs')).syncMain,",
    "  rules: async () => (args) => (args[0] === '--hook'",
    "    ? import('./lib/rules-reach.mjs').then((module) => module.rulesHookMain(args.slice(1)))",
    "    : import('./rules.mjs').then((module) => module.rulesMain(args))),",
    "  'codex-review': async () => (await import('./codex-review.mjs')).codexReviewMain,",
    '};',
  ].join('\n');
  const expected = [
    ['check', 'check.mjs'],
    ['sync', 'install.mjs'],
    ['rules', 'rules.mjs'],
    ['codex-review', 'codex-review.mjs'],
  ];
  assert.deepEqual([...entryFiles(dispatcher)], expected);
  // The checkout on Windows holds CRLF, and the entries must be found all the same.
  assert.deepEqual([...entryFiles(dispatcher.replace(/\n/g, '\r\n'))], expected);
});

test('a heading shown inside a fenced example is not a command section, and the commands come from the Commands line', () => {
  const text = ['## Commands', '', '### js-harness alpha', '', '```md', '## Goal', '### js-harness beta', '```', ''].join('\n');
  assert.deepEqual(commandSections(text, ['alpha', 'beta']).map(({ name }) => name), ['alpha']);
  assert.deepEqual(markdownLines('```md\n## Goal\n```\n## Next').map(({ fenced }) => fenced), [true, true, true, false]);
  assert.deepEqual(commandsFromHelp('Usage: x\n\nCommands:\n  alpha  one\n  beta   two\n\nEnvironment: y'), ['alpha', 'beta']);
  assert.deepEqual(commandsFromHelp('Usage: x\r\n\r\nCommands:\r\n  alpha  one\r\n  beta   two\r\n'), ['alpha', 'beta']);
});

test('a probe is classified by the one refusal it prints: the flag, the sentinel or the value, anything else unprobed', () => {
  const probe = { command: 'alpha', sub: [], flag: '--x', value: 'none', places: ['help'] };
  assert.deepEqual(classifyProbe(probe, { status: 2, stdout: '', stderr: 'unknown argument: --x\n', error: undefined }), { kind: 'not-accepted', detail: 'help' });
  assert.equal(classifyProbe(probe, { status: 2, stdout: '', stderr: 'unknown argument: --zz-audit-sentinel\n', error: undefined }), null);
  assert.equal(classifyProbe(probe, { status: 2, stdout: '', stderr: 'alpha: unknown argument: x\n', error: undefined }), null);
  assert.deepEqual(classifyProbe(probe, { status: 2, stdout: '', stderr: 'unknown argument: run\n', error: undefined }), { kind: 'unprobed', detail: 'unknown argument: run' });
  assert.deepEqual(classifyProbe(probe, { status: 0, stdout: '', stderr: '', error: undefined }), { kind: 'unprobed', detail: 'exit 0, no output' });
  const eq = { ...probe, flag: '--home', value: 'eq' };
  assert.deepEqual(classifyProbe(eq, { status: 2, stdout: '', stderr: 'unknown argument: --home=x\n', error: undefined }), { kind: 'not-accepted', detail: 'help' });
});

test('an allow entry that matches a finding counts it as allowed, and one that matches none is a stale-allow', () => {
  const findings = [{ kind: 'not-accepted', location: 'alpha --ghost', detail: 'help' }];
  const entries = [
    { kind: 'not-accepted', location: 'alpha --ghost', why: 'kept for an old reader' },
    { kind: 'undocumented', location: 'alpha --never', why: 'no longer in the parser' },
  ];
  assert.deepEqual(applyAllow(findings, entries), {
    findings: [{ kind: 'stale-allow', location: 'alpha --never', detail: 'no undocumented finding matches this entry: no longer in the parser' }],
    allowed: 1,
  });
});

test('an accepted flag, a value flag shown with a value and a subcommand flag are no finding', () => {
  withFixture({}, (dir) => {
    const result = audit(dir, ['--json']);
    assert.equal(result.status, 1, result.stderr);
    const { findings } = JSON.parse(result.stdout);
    const locations = findings.map(({ location }) => location);
    for (const accepted of ['alpha --fast', 'alpha --to', 'alpha --pm', 'alpha --home', 'alpha run --deep']) {
      assert.ok(!locations.includes(accepted), `${accepted} is accepted, found: ${locations.join(', ')}`);
    }
  });
});

test('the findings of a fixture: a not-accepted flag names where it is named, an undocumented literal its line, an unprobed command its exit', () => {
  withFixture({}, (dir) => {
    const result = audit(dir, ['--json']);
    assert.deepEqual(JSON.parse(result.stdout), { findings: BASE, allowed: 0 });
    const text = audit(dir);
    assert.equal(text.stdout, [
      'not-accepted  alpha --ghost  help, SPEC:3',
      'unprobed  beta --ignored  exit 0, no output',
      `undocumented  alpha --secret  bin/alpha.mjs:${lineOf(ALPHA, "'--secret'")}`,
      '3 findings, 0 allowed',
      '',
    ].join('\n'));
    assert.equal(text.status, 1);
  });
});

test('an allowed compatibility flag is counted as allowed, and a stale entry is a finding', () => {
  withFixture({
    'allow.json': JSON.stringify([
      { kind: 'not-accepted', location: 'alpha --ghost', why: 'kept for an old reader' },
      { kind: 'undocumented', location: 'alpha --never', why: 'gone' },
    ]),
  }, (dir) => {
    const result = audit(dir, ['--json', '--allow', path.join(dir, 'allow.json')]);
    assert.deepEqual(JSON.parse(result.stdout), {
      findings: [
        BASE[1],
        BASE[2],
        { kind: 'stale-allow', location: 'alpha --never', detail: 'no undocumented finding matches this entry: gone' },
      ],
      allowed: 1,
    });
  });
});

test('--only limits the run to one command, and the allow entries of the others are neither used nor stale', () => {
  withFixture({
    'allow.json': JSON.stringify([{ kind: 'not-accepted', location: 'alpha --ghost', why: 'kept' }]),
  }, (dir) => {
    const result = audit(dir, ['--json', '--only', 'beta', '--allow', path.join(dir, 'allow.json')]);
    assert.deepEqual(JSON.parse(result.stdout), { findings: [BASE[1]], allowed: 0 });
  });
});

test('an unknown argument exits 2 with the one line unknown argument, then the usage', () => {
  withFixture({}, (dir) => {
    const result = audit(dir, ['--no-such-flag']);
    assert.equal(result.status, 2);
    assert.equal(result.stderr.split('\n')[0], 'unknown argument: --no-such-flag');
    assert.equal(result.stdout, '');
  });
});

test('--json prints one object with findings and allowed, each finding with kind, location and detail', () => {
  withFixture({}, (dir) => {
    const result = audit(dir, ['--json']);
    const json = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(json), ['findings', 'allowed']);
    for (const finding of json.findings) assert.deepEqual(Object.keys(finding), ['kind', 'location', 'detail']);
    assert.equal(typeof json.allowed, 'number');
  });
});

test('every home folder of the isolated probe exists, so a probe that makes a temp folder does not fail with ENOENT', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-flags-probe-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const probe = path.join(dir, 'probe.mjs');
  fs.writeFileSync(probe, `import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root = path.dirname(process.cwd());
const homes = Object.entries(process.env).filter(([, value]) => value.startsWith(root + path.sep));
const missing = homes.filter(([, value]) => !fs.statSync(value, { throwIfNoEntry: false })?.isDirectory()).map(([name]) => name);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-from-'));
fs.rmSync(folder, { recursive: true });
console.log(JSON.stringify({ names: homes.map(([name]) => name), missing }));
`);
  const result = isolated(probe, []);
  assert.equal(result.status, 0, result.stderr);
  const { names, missing } = JSON.parse(result.stdout);
  assert.ok(names.includes('HOME') && names.includes('TEMP') && names.includes('TMP'), result.stdout);
  assert.deepEqual(missing, []);
});

const SENTINEL = '--zz-audit-sentinel';
const REPO_ROOT = path.resolve(path.dirname(SCRIPT), '..');
const refused = (stderr, status = 2) => ({ status, stdout: '', stderr, error: undefined });

test('a refusal that names the sentinel in any wording is the parser taking the flag before it', () => {
  const probe = { command: 'throughput', sub: [], flag: '--json', value: 'none', places: ['help'] };
  assert.equal(classifyProbe(probe, refused('js-harness throughput: --zz-audit-sentinel is not an option of throughput\n')), null);
  assert.equal(classifyProbe({ ...probe, command: 'windows-daily' }, refused('js-harness windows-daily: --zz-audit-sentinel is no argument of this command\n')), null);
  assert.equal(classifyProbe({ ...probe, command: 'rules', flag: '--hook' }, refused('js-harness rules --hook: unknown argument --zz-audit-sentinel\n')), null);
});

test('a refusal that names the flag as not an option is not accepted, and one that names the flag and its value is the flag taken', () => {
  const probe = { command: 'loop', sub: ['run'], flag: '--ghost', value: 'none', places: ['help'] };
  assert.deepEqual(classifyProbe(probe, refused('js-harness loop: --ghost is not an option of loop run\n')), { kind: 'not-accepted', detail: 'help' });
  const since = { command: 'throughput', sub: [], flag: '--since', value: 'space', places: ['help'] };
  assert.equal(classifyProbe(since, refused('js-harness throughput: --since takes a day as YYYY-MM-DD: x\n')), null);
  const max = { command: 'gate', sub: [], flag: '--max', value: 'space', places: ['help'] };
  assert.equal(classifyProbe(max, refused('--max takes a number of minutes above zero, not "x"\n')), null);
});

test('a backup probe whose value its command names is taken, and a refusal that names a flag and its missing value is taken', () => {
  const restore = { command: 'backup', sub: ['restore'], flag: '--from', value: 'space', places: ['help'] };
  assert.equal(classifyProbe(restore, refused('backup restore: git clone x failed: Error: spawnSync git ENOENT\n', 1)), null);
  const init = { command: 'backup', sub: ['init'], flag: '--repo', value: 'space', places: ['help'] };
  assert.equal(classifyProbe(init, refused('backup init: --repo <owner/name> is required\n')), null);
});

test('a flag the parser says needs a value is probed once more with one, and a flag its value refusal names is taken', () => {
  const docs = '# spec\n\nThe alpha command takes `js-harness alpha --needy` and `js-harness alpha --since <day>`.\n';
  withFixture({ 'docs/SPEC.md': docs }, (dir) => {
    const probed = [];
    const run = (script, args) => {
      const line = args.join(' ');
      if (args.includes(SENTINEL)) probed.push(line);
      if (line === `alpha --needy ${SENTINEL}`) return refused('js-harness alpha: --needy needs a value\n');
      if (line === `alpha --needy x ${SENTINEL}`) return refused(`js-harness alpha: ${SENTINEL} is not an option of alpha\n`);
      if (line === `alpha --since x ${SENTINEL}`) return refused('js-harness alpha: --since takes a day as YYYY-MM-DD: x\n');
      return isolated(script, args);
    };
    const { findings } = auditFlags({ repo: dir, only: 'alpha', run });
    const locations = findings.map(({ location }) => location);
    assert.ok(!locations.includes('alpha --needy'), locations.join(', '));
    assert.ok(!locations.includes('alpha --since'), locations.join(', '));
    assert.deepEqual(probed.filter((call) => call.startsWith('alpha --needy')), [`alpha --needy ${SENTINEL}`, `alpha --needy x ${SENTINEL}`]);
  });
});

test('a help line that opens with a sub word places the flags of its usage after that word, and a flag of the description is bare', () => {
  const commands = ['backup', 'init', 'restore', 'verify', 'summary'];
  const restore = '  restore --from <dir|git url> [--home <dir>] [--merge]  Put a backup into a home, with --transcripts named in prose';
  assert.deepEqual(flagsOnLine(restore, 'backup', commands).map(({ command, sub, flag }) => [command, sub, flag]), [
    ['backup', ['restore'], '--from'],
    ['backup', ['restore'], '--home'],
    ['backup', ['restore'], '--merge'],
    ['backup', [], '--transcripts'],
  ]);
  const run = '  run [--allow-shrink] [--adopt] [--transcripts]  Back up now: the Engram export';
  assert.deepEqual(flagsOnLine(run, 'backup', commands).map(({ sub, flag }) => [sub, flag]), [
    [['run'], '--allow-shrink'],
    [['run'], '--adopt'],
    [['run'], '--transcripts'],
  ]);
});

test('the flags written in an alternatives group of the usage line are subcommands, not flags', () => {
  assert.deepEqual(subcommandFlags('Usage: js-harness backup <run | status | --hook | --session-start>\n  run [--adopt]  Back up now\n'), ['--hook', '--session-start']);
  assert.deepEqual(subcommandFlags('Usage: js-harness guard --hook\n'), []);
});

// Since backup refuses an argument it does not know (launch audit C-backup-12), each probe stops at its parse: the
// probe's extra words are refused before any config or repository is read.
test('the backup probes stop before any action in an empty home: each subcommand refuses the probe\'s extra words at its parse', () => {
  const dispatcher = path.join(REPO_ROOT, 'bin', 'js-harness.mjs');
  const run = isolated(dispatcher, ['backup', 'run', '--allow-shrink', 'x', SENTINEL]);
  assert.equal(run.status, 2, run.stderr);
  assert.match(run.stderr, /^js-harness backup run: unknown argument: x$|^backup run: unknown argument: x$/m);
  const init = isolated(dispatcher, ['backup', 'init', '--repo', 'x', SENTINEL]);
  assert.equal(init.status, 2, init.stderr);
  assert.match(init.stderr, new RegExp(`backup init: unknown argument: ${SENTINEL}`));
});

test('a refusal that prints a lone x unrelated to the probed flag is unprobed, and an x in its flag sentence is the value taken', () => {
  const probe = { command: 'throughput', sub: [], flag: '--day', value: 'space', places: ['help'] };
  const unrelated = 'cannot read /home/x/.js-harness/log: no such file\nusage: js-harness throughput <x>\n';
  assert.deepEqual(classifyProbe(probe, refused(unrelated, 1)), { kind: 'unprobed', detail: 'cannot read /home/x/.js-harness/log: no such file' });
  assert.equal(classifyProbe(probe, refused('js-harness throughput: --day is not a day: x\n', 1)), null);
});
