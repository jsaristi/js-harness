// `unseen`: what the desktop app opened out of his sight, read from the same records as the board. Each
// test builds a fake machine in temp folders: the app's records under APPDATA (win32), the Claude home with
// the transcripts and the scheduled tasks' folders, and the harness home. The project is injected by its root.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unseenMain } from './unseen.mjs';
import { sessionFacts } from './lib/sessions.mjs';

const ROOT = 'D:\\js-harness';
const SLUG = 'D--js-harness';
const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const SESSION = '130317af-1111-4222-8333-444455556666';
const at = (minutes) => new Date(NOW - minutes * 60 * 1000).toISOString();

/** A fake machine: `appData` holds the app's records, `claude` the Claude home, `home` the harness home. */
function machine() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-unseen-'));
  const appData = path.join(base, 'appdata');
  const claude = path.join(base, 'claude');
  const home = path.join(base, 'home');
  const records = path.join(appData, 'Claude', 'claude-code-sessions', 'acct', 'org');
  const projectDir = path.join(claude, 'projects', SLUG);
  fs.mkdirSync(records, { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  return {
    claude,
    home,
    env: { APPDATA: appData, JS_HARNESS_HOME: home },
    tasks(list) {
      fs.writeFileSync(path.join(records, 'scheduled-tasks.json'), JSON.stringify({ scheduledTasks: list }));
    },
    record(name, data) {
      fs.writeFileSync(path.join(records, `local_${name}.json`), JSON.stringify(data));
    },
    /** A transcript of this project with one message the user sent `minutes` ago, opened as the arguments say. */
    transcript(id, { turnOrigin = 'human', entrypoint = 'claude-desktop', minutes = 30, title = null } = {}) {
      const user = { type: 'user', uuid: `${id}-1`, timestamp: at(minutes), cwd: ROOT, gitBranch: 'main', isSidechain: false, turnOrigin, entrypoint, message: { role: 'user', content: 'hola' } };
      const lines = [user];
      if (title !== null) lines.push({ type: 'custom-title', sessionId: id, customTitle: title });
      fs.writeFileSync(path.join(projectDir, `${id}.jsonl`), `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
    },
    skill(id, text) {
      const dir = path.join(claude, 'scheduled-tasks', id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'SKILL.md'), text);
    },
    remove() {
      fs.rmSync(path.dirname(claude), { recursive: true, force: true });
    },
  };
}

/** Runs `unseen` on `m` with the project at ROOT and the clock at NOW; returns the exit code and what it printed. */
async function unseen(m, argv = [], extra = {}) {
  const out = [];
  const err = [];
  const code = await unseenMain(['--claude-home', m.claude, ...argv], {
    cwd: ROOT,
    root: ROOT,
    env: m.env,
    platform: 'win32',
    now: () => NOW,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const NOTHING = 'unseen: nothing opened out of his sight';

test('an enabled scheduled task of this project fails, names it and exits 1', async () => {
  const m = machine();
  try {
    m.tasks([{ id: 'jh-wake', cwd: ROOT, enabled: true }]);
    const r = await unseen(m);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /^FAIL {2}.*jh-wake/m);
    assert.equal(r.out.split('\n').at(-1), 'unseen: 1 to clear');
  } finally {
    m.remove();
  }
});

test('a disabled scheduled task of this project is information, and exits 0', async () => {
  const m = machine();
  try {
    m.tasks([{ id: 'jh-wake', cwd: ROOT, enabled: false }]);
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /^INFO {2}.*jh-wake/m);
    assert.doesNotMatch(r.out, /^FAIL/m);
    assert.equal(r.out.split('\n').at(-1), NOTHING);
  } finally {
    m.remove();
  }
});

test('a folder under scheduled-tasks with no registry entry is information: a leftover', async () => {
  const m = machine();
  try {
    m.tasks([{ id: 'jh-live', cwd: 'C:\\other', enabled: true }]);
    m.skill('jh-old', 'A folder the app no longer schedules.\n');
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /^INFO {2}.*leftover.*jh-old/m);
  } finally {
    m.remove();
  }
});

test('a task of another project, or of a folder that only begins with this one, is not named', async () => {
  const m = machine();
  try {
    m.tasks([
      { id: 'jh-other', cwd: 'C:\\other', enabled: true },
      { id: 'jh-sibling', cwd: 'D:\\js-harness-worktrees\\session-unseen', enabled: true },
    ]);
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.doesNotMatch(r.out, /jh-other|jh-sibling/);
    assert.equal(r.out, NOTHING);
  } finally {
    m.remove();
  }
});

test('a task under this project in a subfolder fails whatever the slashes and the case of its path', async () => {
  const m = machine();
  try {
    m.tasks([{ id: 'jh-sub', cwd: 'd:/JS-HARNESS/sub', enabled: true }]);
    const r = await unseen(m);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /^FAIL {2}.*jh-sub/m);
  } finally {
    m.remove();
  }
});

test('with no registry, a SKILL.md that holds this project path fails, and its path is named', async () => {
  const m = machine();
  try {
    m.skill('jh-skill', 'Each day, work in D:\\js-harness and open the board.\n');
    const r = await unseen(m);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /^FAIL .*jh-skill[\\/]SKILL\.md/m);
  } finally {
    m.remove();
  }
});

test('with no registry, a SKILL.md that only names the project, or a sibling folder, does not fail', async () => {
  const m = machine();
  try {
    m.skill('jh-name', 'The js-harness project, and a checkout at D:\\js-harness-worktrees\\session-unseen.\n');
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(r.out, NOTHING);
  } finally {
    m.remove();
  }
});

test('a scheduled session in Routines fails and names its title, its transcript and where it sits', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'scheduled', title: 'Wake after plan reset' });
    m.record('1', { cliSessionId: SESSION, scheduledTaskId: 'jh-wake', isArchived: false, effort: 'medium' });
    const r = await unseen(m);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /^FAIL {2}.*Wake after plan reset.*130317af-1111.*Routines/m);
  } finally {
    m.remove();
  }
});

test('an archived scheduled session is not a failure', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'scheduled' });
    m.record('1', { cliSessionId: SESSION, scheduledTaskId: 'jh-wake', isArchived: true });
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(r.out, NOTHING);
  } finally {
    m.remove();
  }
});

test('a session opened by a command is information: it is not in the app', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'sdk', entrypoint: 'sdk-cli' });
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /^INFO {2}.*130317af-1111.*command/m);
  } finally {
    m.remove();
  }
});

test('a scheduled session with no app record fails, and says the app record is missing', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'scheduled' });
    const r = await unseen(m);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /^FAIL {2}.*130317af-1111.*app record.*missing/m);
  } finally {
    m.remove();
  }
});

test('a session he opened that sits in Sessions is nothing, and nothing opened exits 0 with its line', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'human' });
    m.record('1', { cliSessionId: SESSION, isArchived: false });
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(r.out, NOTHING);
  } finally {
    m.remove();
  }
});

test('a session outside the window is not read; --hours widens it', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'scheduled', minutes: 9 * 24 * 60 });
    m.record('1', { cliSessionId: SESSION, scheduledTaskId: 'jh-wake', isArchived: false });
    const outside = await unseen(m);
    assert.equal(outside.code, 0, outside.out + outside.err);
    const widened = await unseen(m, ['--hours', '240']);
    assert.equal(widened.code, 1, widened.out + widened.err);
    assert.match(widened.out, /130317af-1111/);
  } finally {
    m.remove();
  }
});

test('--json gives the items with their level and the number to clear', async () => {
  const m = machine();
  try {
    m.tasks([{ id: 'jh-wake', cwd: ROOT, enabled: true }]);
    const r = await unseen(m, ['--json']);
    assert.equal(r.code, 1, r.out + r.err);
    const data = JSON.parse(r.out);
    assert.equal(data.toClear, 1);
    assert.deepEqual(data.items.map((item) => item.level), ['FAIL']);
  } finally {
    m.remove();
  }
});

// The app's session records carry the folder a session runs in (`cwd`), so a scheduled session of this project
// is named without reading a transcript. The transcript reader that throws below is the proof: it is never called.
const SESSION_B = '2b2b2b2b-1111-4222-8333-444455556666';

/** A transcript reader that counts its calls and otherwise reads as the board does: the guard of `--records-only`. */
function readSpy() {
  const spy = { calls: 0, readFacts: (text, options) => {
    spy.calls += 1;
    return sessionFacts(text, options);
  } };
  return spy;
}

test('--records-only fails a scheduled session record of this project that is not archived, named by title and id, and reads no transcript while the full command does', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'scheduled', title: 'Wake after plan reset' });
    m.record('1', { cliSessionId: SESSION, scheduledTaskId: 'jh-wake', isArchived: false, cwd: ROOT, title: 'Wake after plan reset' });
    const quick = readSpy();
    const r = await unseen(m, ['--records-only'], { readFacts: quick.readFacts });
    assert.equal(r.code, 1, r.out + r.err);
    assert.equal(quick.calls, 0, 'the records-only path reads no transcript');
    assert.match(r.out, /^FAIL {2}Wake after plan reset \(130317af-1111-4222-8333-444455556666\): opened by a scheduled task, in Routines$/m);
    assert.equal(r.out.split('\n').at(-1), 'unseen: 1 to clear');
    const full = readSpy();
    const whole = await unseen(m, [], { readFacts: full.readFacts });
    assert.ok(full.calls >= 1, 'the full command reads the transcript');
    assert.equal(whole.code, 1, whole.out + whole.err);
  } finally {
    m.remove();
  }
});

test('--records-only is nothing for an archived record, a record with no scheduled task, or a record of another folder, and it reads a sub-folder of this project', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'scheduled' });
    m.record('1', { cliSessionId: SESSION, scheduledTaskId: 'jh-wake', isArchived: true, cwd: ROOT });
    m.record('2', { cliSessionId: SESSION_B, scheduledTaskId: '', isArchived: false, cwd: ROOT });
    m.record('3', { cliSessionId: 'c-other-folder-1111', scheduledTaskId: 'jh-wake', isArchived: false, cwd: 'C:\\other' });
    const quiet = readSpy();
    const r = await unseen(m, ['--records-only'], { readFacts: quiet.readFacts });
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(r.out, NOTHING);
    assert.equal(quiet.calls, 0, 'the records-only path reads no transcript');
    m.record('4', { cliSessionId: 'c-sub-folder-2222', scheduledTaskId: 'jh-wake', isArchived: false, cwd: 'd:/JS-HARNESS/sub' });
    const sub = await unseen(m, ['--records-only'], { readFacts: readSpy().readFacts });
    assert.equal(sub.code, 1, sub.out + sub.err);
    assert.match(sub.out, /^FAIL {2}.*c-sub-folder-2222/m);
  } finally {
    m.remove();
  }
});

// Two transcripts of one title are one row of the board, whose `where` comes from its latest member. Each
// transcript is judged by its own app record: the older, scheduled and not archived, is a FAIL, whatever the
// archived latest one says, in the full command and in --records-only alike.
test('a row of two transcripts with one title judges each by its own record: the older scheduled one that is not archived FAILs, in both modes', async () => {
  const OLDER = 'a1a1a1a1-1111-4222-8333-444455556666';
  const LATEST = 'b2b2b2b2-1111-4222-8333-444455556666';
  const m = machine();
  try {
    m.transcript(OLDER, { turnOrigin: 'scheduled', minutes: 120, title: 'Same title' });
    m.transcript(LATEST, { turnOrigin: 'human', minutes: 10, title: 'Same title' });
    m.record('1', { cliSessionId: OLDER, scheduledTaskId: 'jh-wake', isArchived: false, cwd: ROOT, title: 'Same title' });
    m.record('2', { cliSessionId: LATEST, scheduledTaskId: 'jh-wake', isArchived: true, cwd: ROOT, title: 'Same title' });
    for (const argv of [[], ['--records-only']]) {
      const r = await unseen(m, argv);
      assert.equal(r.code, 1, `${argv.join(' ') || 'full'}: ${r.out}${r.err}`);
      const fails = r.out.split('\n').filter((line) => line.startsWith('FAIL'));
      assert.equal(fails.length, 1, `${argv.join(' ') || 'full'}: ${r.out}`);
      assert.ok(fails[0].includes(OLDER), fails[0]);
      assert.ok(!r.out.includes(LATEST), `${argv.join(' ') || 'full'}: the archived one is named nowhere: ${r.out}`);
    }
  } finally {
    m.remove();
  }
});

// An empty registry is a registry: it says nothing is scheduled, so a leftover folder that names the project is
// information, and the fallback that reads the folders' SKILL.md runs only where there is no registry at all.
test('an empty registry is a registry: a leftover folder that names the project is information, not a failure', async () => {
  const m = machine();
  try {
    m.tasks([]);
    m.skill('jh-leftover', 'A folder that names D:\\js-harness, left by the app.\n');
    const r = await unseen(m);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /^INFO {2}leftover.*jh-leftover/m);
    assert.doesNotMatch(r.out, /^FAIL/m);
  } finally {
    m.remove();
  }
});

test('the full command names a scheduled record that no transcript row covers, once, and does not repeat a session a row covers', async () => {
  const m = machine();
  try {
    m.transcript(SESSION, { turnOrigin: 'scheduled', title: 'Covered' });
    m.record('1', { cliSessionId: SESSION, scheduledTaskId: 'jh-wake', isArchived: false, cwd: ROOT, title: 'Covered' });
    m.record('2', { cliSessionId: SESSION_B, scheduledTaskId: 'jh-wake', isArchived: false, cwd: ROOT, title: 'Uncovered' });
    const r = await unseen(m);
    assert.equal(r.code, 1, r.out + r.err);
    assert.equal(r.out.split('\n').filter((line) => line.includes(SESSION)).length, 1, r.out);
    assert.match(r.out, /^FAIL {2}Uncovered \(2b2b2b2b-1111-4222-8333-444455556666\): opened by a scheduled task, in Routines$/m);
    assert.equal(r.out.split('\n').at(-1), 'unseen: 2 to clear');
  } finally {
    m.remove();
  }
});

test('an unknown argument, or an hours value that is not above zero, is a usage error: exit 2', async () => {
  const m = machine();
  try {
    const unknown = await unseen(m, ['--bogus']);
    assert.equal(unknown.code, 2);
    assert.match(unknown.err, /Usage: js-harness unseen/);
    const zero = await unseen(m, ['--hours', '0']);
    assert.equal(zero.code, 2);
    assert.match(zero.err, /--hours takes a number above zero/);
  } finally {
    m.remove();
  }
});
