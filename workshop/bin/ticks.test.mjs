// `ticks --hook`, the session start's word on the heartbeat's three workshop ticks (odd/tasks/audit-u3-heartbeat-ticks.md):
// the age of what each tick leaves, the loop on record, the idea-watch row, and a hook that never fails a session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ownerOf } from '../../bin/lib/hook-count.mjs';
import { mainCheckoutByFiles } from '../../bin/lib/inbox.mjs';
import { projectSlug } from '../../bin/lib/sessions.mjs';
import { TICKS_STALE_HOURS, ticksMain } from './ticks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOUR = 3600 * 1000;
// 2026-11-10 at 14:00 UTC: 2026-11-09 settled at 01:00 (two gate-max after midnight), 13 hours before.
const NOW = Date.parse('2026-11-10T14:00:00Z');

/** A home and a project folder with no git, so the project is the folder itself; `fn` gets them and a writer. */
async function withWorld(fn) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-ticks-'));
  const home = path.join(scratch, 'home');
  const cwd = path.join(scratch, 'project');
  fs.mkdirSync(cwd, { recursive: true });
  const slug = projectSlug(cwd);
  const write = (parts, text) => {
    const file = path.join(home, '.js-harness', ...parts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const at = (ms) => `${new Date(ms).toISOString()}\n`;
  const set = {
    snapshot: (day) => write(['throughput', slug, `${day}.json`], '{}'),
    windows: (ms) => write(['channel', 'windows-daily', slug, 'asked'], at(ms)),
    host: (ms) => write(['channel', 'host-watch', slug, 'asked'], at(ms)),
    loop: (command) => write(['loops', slug, 'heartbeat.json'], JSON.stringify({ schema: 'js-harness.loop/v1', name: 'heartbeat', owner: 'o', pid: 1, createdAt: 1, startedAt: '2026-11-10T06:15:54.144Z', purpose: 'p', until: 'u', command, cwd })),
  };
  try {
    return await fn({ home, cwd, set });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

async function runTicks(argv, { home, cwd }, { now = NOW, ideas = async () => null, fileSystem } = {}) {
  const out = [];
  const err = [];
  const code = await ticksMain(argv, { cwd, env: {}, homedir: () => home, now: () => now, stdout: (line) => out.push(line), stderr: (line) => err.push(line), ideas, ...(fileSystem ? { fileSystem } : {}) });
  return { code, out, err };
}

const messageOf = (out) => {
  assert.equal(out.length, 1, `one line: ${out.join('\n')}`);
  return JSON.parse(out[0]).systemMessage;
};

test('a stale row against a home whose newest snapshot is two days old: the hook exits 0 and says it', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const { code, out, err } = await runTicks(['--hook'], { home, cwd });
    assert.equal(code, 0);
    assert.deepEqual(err, []);
    const message = messageOf(out);
    assert.match(message, /throughput: the newest snapshot is 2026-11-08, and 2026-11-09, settled at 2026-11-10T01:00:00\.000Z, has none/);
    assert.match(message, /node workshop\/js-harness-workshop\.mjs loop heartbeat/);
    assert.doesNotMatch(message, /windows-daily|host-watch/);
  });
});

test('the same home read by hand prints each tick and exits 1 on the stale one', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const { code, out } = await runTicks([], { home, cwd });
    assert.equal(code, 1);
    assert.ok(out.some((line) => /^STALE {2}throughput: /.test(line)), out.join('\n'));
    assert.ok(out.some((line) => /^ok {5}windows-daily: last read at 2026-11-10T13:00:00\.000Z/.test(line)), out.join('\n'));
    assert.ok(out.some((line) => /^ok {5}host-watch: last read at 2026-11-10T13:00:00\.000Z/.test(line)), out.join('\n'));
  });
});

test('a missing day still inside its grace is not stale: the heartbeat keeps it within minutes once it runs', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    // 2026-11-09 settled at 01:00 UTC; at 05:00 it has waited 4 hours, under the grace.
    const now = Date.parse('2026-11-10T05:00:00Z');
    set.windows(now - HOUR);
    set.host(now - HOUR);
    const { code, out } = await runTicks(['--hook'], { home, cwd }, { now });
    assert.equal(code, 0);
    assert.deepEqual(out, []);
  });
});

test('every tick fresh: the hook prints nothing, and the hand run exits 0', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    set.snapshot('2026-11-09');
    set.windows(NOW - HOUR);
    set.host(NOW - 2 * HOUR);
    assert.deepEqual((await runTicks(['--hook'], { home, cwd })).out, []);
    assert.equal((await runTicks([], { home, cwd })).code, 0);
  });
});

test(`an asked file older than ${TICKS_STALE_HOURS} hours, or none, is a stale tick with its last read`, async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-09');
    set.windows(Date.parse('2026-11-03T02:18:40.158Z'));
    const message = messageOf((await runTicks(['--hook'], { home, cwd })).out);
    assert.match(message, /windows-daily: last read at 2026-11-03T02:18:40\.158Z/);
    assert.match(message, /host-watch: never read/);
    assert.doesNotMatch(message, /throughput/);
  });
});

test('no snapshot kept at all is a stale throughput tick', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    assert.match(messageOf((await runTicks(['--hook'], { home, cwd })).out), /throughput: no snapshot is kept/);
  });
});

test('a heartbeat on record that runs the product\'s command is named as the cause; the workshop\'s is not', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-01');
    set.loop(['js-harness', 'loop', 'heartbeat']);
    const product = messageOf((await runTicks(['--hook'], { home, cwd })).out);
    assert.match(product, /the heartbeat on record \(since 2026-11-10T06:15:54\.144Z\) runs js-harness loop heartbeat, the product's, which runs no tick/);
    set.loop(['node', 'workshop/js-harness-workshop.mjs', 'loop', 'heartbeat']);
    assert.doesNotMatch(messageOf((await runTicks(['--hook'], { home, cwd })).out), /on record/);
  });
});

test('the idea-watch row reaches the session start: an unread release is said, none or no record says nothing', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-09');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const asked = [];
    const ideas = async (project) => {
      asked.push(project);
      return { last: '4.3.1', unread: ['4.4.0'] };
    };
    const message = messageOf((await runTicks(['--hook'], { home, cwd }, { ideas })).out);
    assert.match(message, /idea-watch: 1 release not yet read \(the last read is v4\.3\.1\): v4\.4\.0/);
    assert.deepEqual(asked, [cwd]);
    assert.deepEqual((await runTicks(['--hook'], { home, cwd }, { ideas: async () => ({ last: '4.4.0', unread: [] }) })).out, []);
    assert.deepEqual((await runTicks(['--hook'], { home, cwd }, { ideas: async () => null })).out, []);
  });
});

test('the hook never fails a session: a reading that throws is said in the message, never on stderr, and it exits 0', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-09');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const broken = {
      readdirSync: () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      },
      readFileSync: () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      },
    };
    const ideas = async () => {
      throw new Error('could not list the tags');
    };
    const { code, out, err } = await runTicks(['--hook'], { home, cwd }, { fileSystem: broken, ideas });
    assert.equal(code, 0);
    assert.deepEqual(err, []);
    const message = messageOf(out);
    assert.match(message, /throughput: the snapshots could not be read \(EACCES\)/);
    assert.match(message, /windows-daily: could not be read \(EACCES\)/);
    assert.match(message, /idea-watch: could not be read \(could not list the tags\)/);
  });
});

test('a relative --home is read from where the command runs, as the commands that write the records read it', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-09');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    // Run from the home's parent with --cwd naming the project: the home is `./home` there, not under the project.
    const out = [];
    const code = await ticksMain(['--hook', '--cwd', cwd, '--home', 'home'], { cwd: path.dirname(home), env: {}, homedir: () => '/nowhere', now: () => NOW, stdout: (line) => out.push(line), stderr: () => {}, ideas: async () => null });
    assert.equal(code, 0);
    assert.deepEqual(out, []);
  });
});

test('--help prints the usage, and an argument it does not know is a usage error, with --hook too', async () => {
  await withWorld(async ({ home, cwd }) => {
    const help = await runTicks(['--help'], { home, cwd });
    assert.equal(help.code, 0);
    assert.match(help.out.join('\n'), /^Usage: node workshop\/js-harness-workshop\.mjs ticks/);
    for (const argv of [['--hours'], ['--hook', '--quiet']]) {
      const bad = await runTicks(argv, { home, cwd });
      assert.equal(bad.code, 2);
      assert.deepEqual(bad.out, []);
      assert.match(bad.err.join('\n'), /unknown argument/);
    }
  });
});

// His answer to question 245 (odd/tasks/audit-u3-heartbeat-ticks.md, L8) covers this one entry: the project settings
// hold it alone, so another hook, or another key, enters them only in a change that says why.
test('this repository runs it at each session start, alone in its project settings, with a timeout of its own', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const command = hookCommand();
  assert.deepEqual(settings, {
    hooks: {
      SessionStart: [{ matcher: 'startup|resume', hooks: [{ type: 'command', command, timeout: 15 }] }],
    },
  });
  // node finds the dispatcher itself, so the command holds nothing a shell expands or reads its own way: Git Bash
  // and PowerShell, the two shells the host runs a hook in on Windows, expand `$` and the backtick differently.
  assert.match(command, /^node -e "[^"$`\\%!^]+" workshop\/js-harness-workshop\.mjs ticks --hook$/);
  // The row that counts the hooks still reads it as the workshop's, the owner his answer covers.
  assert.equal(ownerOf({ command }), 'workshop');
});

// git reaches no network in these runs: its proxy is a local port nothing listens on, so the idea-watch row, the one
// reading of the hook that asks the network, fails at once and is said after the ticks' part, as offline.
const NO_NETWORK = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.proxy', GIT_CONFIG_VALUE_0: 'http://127.0.0.1:9' };

/** The command of the one hook this repository's settings hold. */
function hookCommand() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8')).hooks.SessionStart[0].hooks[0].command;
}

/** Run the hook's command as written, through the platform's shell, from `cwd` with `projectDir` as the host's
 * variable (`undefined` for none). It asks for the usage instead of the reading, which needs the network, unless
 * `tail` gives what follows the dispatcher's command. */
function runHookCommand(cwd, projectDir, tail = '--help') {
  const env = { ...process.env, ...NO_NETWORK };
  delete env.CLAUDE_PROJECT_DIR;
  if (projectDir !== undefined) env.CLAUDE_PROJECT_DIR = projectDir;
  const command = hookCommand().replace(/^node /, `"${process.execPath}" `).replace(/--hook$/, tail);
  const result = spawnSync(command, { cwd, env, shell: true, encoding: 'utf8', timeout: 30_000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// Codex's finding on 7c962911: a relative script is looked for in the folder the hook runs in, so from any other
// folder node failed with its module not found and the notice was lost.
test('the hook\'s command finds the dispatcher from a folder that is not the root, by the host\'s variable or without it', () => {
  const deep = path.join(ROOT, 'workshop', 'bin');
  for (const [cwd, projectDir, why] of [
    [ROOT, undefined, 'the root, no variable'],
    [deep, ROOT, 'a subfolder, the variable set'],
    [deep, undefined, 'a subfolder, no variable: the nearest folder above that holds the dispatcher'],
    [deep, '', 'a subfolder, the variable empty, as one shell leaves it'],
    [os.tmpdir(), ROOT, 'a folder outside the repository, the variable set'],
    [ROOT, os.tmpdir(), 'the root, the variable naming a folder that holds none: the folder it runs in is searched next'],
  ]) {
    const result = runHookCommand(cwd, projectDir);
    assert.deepEqual({ status: result.status, stderr: result.stderr }, { status: 0, stderr: '' }, why);
    assert.match(result.stdout, /^Usage: node workshop\/js-harness-workshop\.mjs ticks/, why);
  }
});

// The land's suite of 2026-11-11 (gate f7a95e59) ran in a copy of the tree with no `.git`, where the folder a command
// runs in is a project of its own: the hook found the dispatcher above the subfolder and read the subfolder's
// records. The command now runs the dispatcher in the folder that holds it, which this holds with a tree of no git.
test('the hook\'s command runs the dispatcher in the folder that holds it, whatever folder the hook ran in', () => {
  const tree = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ticks-hook-tree-')));
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ticks-hook-outside-')));
  try {
    const deep = path.join(tree, 'workshop', 'deep');
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(tree, 'workshop', 'js-harness-workshop.mjs'), 'console.log(JSON.stringify({ cwd: process.cwd(), argv: process.argv.slice(2) }));\n');
    for (const [cwd, projectDir, why] of [
      [tree, undefined, 'the folder that holds it'],
      [deep, undefined, 'a subfolder, no variable'],
      [deep, outside, 'a subfolder, the variable naming a folder that holds none'],
      [outside, tree, 'a folder outside the tree, the variable set'],
    ]) {
      const result = runHookCommand(cwd, projectDir);
      assert.deepEqual({ status: result.status, stderr: result.stderr }, { status: 0, stderr: '' }, why);
      assert.deepEqual(JSON.parse(result.stdout), { cwd: tree, argv: ['ticks', '--help'] }, why);
    }
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

// The command as the settings hold it, in hook mode, from a folder that is not the root: it reads this repository's
// records, not the folder's. The home holds one fresh reading of the Windows run filed under this repository, so
// that row is missing from the message while the two with nothing kept are said.
test('the hook itself, run from a subfolder or from outside by the host\'s variable, reads the records of this repository', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ticks-hook-home-'));
  try {
    const project = mainCheckoutByFiles(ROOT);
    const asked = path.join(home, '.js-harness', 'channel', 'windows-daily', projectSlug(project), 'asked');
    fs.mkdirSync(path.dirname(asked), { recursive: true });
    fs.writeFileSync(asked, `${new Date().toISOString()}\n`);
    for (const [cwd, projectDir, why] of [
      [path.join(ROOT, 'workshop', 'bin'), undefined, 'a subfolder, no variable'],
      [home, ROOT, 'a folder outside the repository, the variable set'],
    ]) {
      const result = runHookCommand(cwd, projectDir, `--hook --home "${home}"`);
      assert.deepEqual({ status: result.status, stderr: result.stderr }, { status: 0, stderr: '' }, why);
      const message = messageOf(result.stdout.trim().split('\n'));
      assert.match(message, /^js-harness workshop: the heartbeat's ticks have not run for \d+ hours: throughput: no snapshot is kept .*; host-watch: never read/, why);
      assert.doesNotMatch(message, /windows-daily:/, why);
      // Offline, the row that needs the network is said as not read, after the ticks' part, and nothing fails.
      assert.match(message, /; and idea-watch: could not be read \(/, why);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a dispatcher that is found and does not load is said to the session, never on stderr, and it exits 0', () => {
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'ticks-hook-broken-'));
  try {
    fs.mkdirSync(path.join(broken, 'workshop'));
    fs.writeFileSync(path.join(broken, 'workshop', 'js-harness-workshop.mjs'), 'throw new Error("broken on purpose");\n');
    const result = runHookCommand(broken, undefined);
    assert.deepEqual({ status: result.status, stderr: result.stderr }, { status: 0, stderr: '' });
    assert.match(messageOf(result.stdout.trim().split('\n')), /^js-harness workshop: ticks --hook could not load .*js-harness-workshop\.mjs: broken on purpose$/);
  } finally {
    fs.rmSync(broken, { recursive: true, force: true });
  }
});

test('the hook\'s command never fails a session where no dispatcher is found: nothing printed, exit 0', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ticks-hook-'));
  try {
    for (const projectDir of [undefined, '', outside, path.join(outside, 'gone')]) {
      assert.deepEqual(runHookCommand(outside, projectDir), { status: 0, stdout: '', stderr: '' }, String(projectDir));
    }
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
