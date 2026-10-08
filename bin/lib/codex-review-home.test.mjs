import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLeanHome, leanHomesDir, realCodexHome, sweepStaleLeanHomes } from './codex-review-home.mjs';

// Every "real" Codex home here is a temporary folder with a fixture for a login: no test reads, links
// or stats anything of the machine's own Codex home.
const LOGIN = 'FIXTURE login, not a token\n';
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-review-home-'));
  made.push(dir);
  return dir;
}

/** A fake real Codex home that holds a login, and the folder the lean homes go in, both in one
 * temporary folder (so on one volume). */
function homes({ login = LOGIN } = {}) {
  const root = tmp();
  const realHome = path.join(root, 'real', '.codex');
  fs.mkdirSync(realHome, { recursive: true });
  const realAuth = path.join(realHome, 'auth.json');
  if (login !== null) fs.writeFileSync(realAuth, login, 'utf8');
  return { root, realHome, realAuth, parent: path.join(root, 'state', '.js-harness', 'codex-review-homes') };
}

const identity = (file) => {
  const { dev, ino } = fs.statSync(file, { bigint: true });
  return `${dev}:${ino}`;
};
const links = (file) => fs.statSync(file).nlink;
const read = (file) => fs.readFileSync(file, 'utf8');

/** What a Codex session leaves in its home: files and folders beside the login. */
function codexWrites(home) {
  fs.mkdirSync(path.join(home, 'sessions', '2026', '10'), { recursive: true });
  fs.writeFileSync(path.join(home, 'sessions', '2026', '10', 'rollout.jsonl'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(home, 'log'));
  fs.writeFileSync(path.join(home, 'log', 'codex-tui.log'), 'line\n', 'utf8');
  fs.writeFileSync(path.join(home, 'version.json'), '{}', 'utf8');
}

// --- where the homes are ---

test('realCodexHome: `CODEX_HOME` when it is set and not empty, else `.codex` under the OS home', () => {
  assert.equal(realCodexHome({ CODEX_HOME: path.join('x', 'codex') }, path.join('h', 'me')), path.join('x', 'codex'));
  assert.equal(realCodexHome({}, path.join('h', 'me')), path.join('h', 'me', '.codex'));
  assert.equal(realCodexHome({ CODEX_HOME: '' }, path.join('h', 'me')), path.join('h', 'me', '.codex'));
});

test('realCodexHome: on Windows the name is found whatever its case, the first that is not empty; elsewhere only as `CODEX_HOME`', () => {
  const me = path.join('h', 'me');
  const fallback = path.join(me, '.codex');
  const [one, two] = [path.join('x', 'one'), path.join('x', 'two')];
  // A plain object, as an injected environment is: `process.env` folds the case on Windows, this does not.
  assert.equal(realCodexHome({ Codex_Home: one }, me, 'win32'), one);
  assert.equal(realCodexHome({ codex_home: one }, me, 'win32'), one);
  assert.equal(realCodexHome({ CODEX_HOME: one }, me, 'win32'), one);
  assert.equal(realCodexHome({ codex_home: '', Codex_Home: one, CODEX_HOME: two }, me, 'win32'), one);
  assert.equal(realCodexHome({ Codex_Home: '', OTHER_CODEX_HOME: one, CODEX_HOME_2: one }, me, 'win32'), fallback);
  for (const platform of ['linux', 'darwin']) {
    assert.equal(realCodexHome({ Codex_Home: one }, me, platform), fallback, platform);
    assert.equal(realCodexHome({ Codex_Home: one, CODEX_HOME: two }, me, platform), two, platform);
  }
});

test('leanHomesDir: one folder of the harness\'s machine state dir', () => {
  assert.equal(leanHomesDir(path.join('h', 'me')), path.join('h', 'me', '.js-harness', 'codex-review-homes'));
});

// --- making a lean home ---

test('createLeanHome makes `<parent>/<id>` and gives the login a second name there: the same file, not a copy', () => {
  const { realHome, realAuth, parent } = homes();
  const before = identity(realAuth);
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  assert.equal(lean.home, path.join(parent, 'run-1'));
  assert.equal(path.isAbsolute(lean.home), true);
  assert.deepEqual(fs.readdirSync(lean.home), ['auth.json'], 'nothing else of the real home is there');
  assert.equal(identity(path.join(lean.home, 'auth.json')), before, 'the same device and file id');
  assert.equal(identity(realAuth), before);
  assert.equal(links(realAuth), 2);
  assert.equal(read(realAuth), LOGIN, 'making the link does not touch the bytes');
  assert.equal(lean.dispose(), null);
});

test('a relative parent still gives an absolute home, since Codex runs from another folder', () => {
  const { root, realAuth, parent } = homes();
  const cwd = process.cwd();
  // This file's tests run one at a time in a process of their own, so the change is seen by no other.
  process.chdir(root);
  try {
    const lean = createLeanHome({ realHome: path.join('real', '.codex'), parent: path.relative(root, parent), id: 'run-1' });
    assert.equal(path.isAbsolute(lean.home), true);
    assert.equal(fs.realpathSync(lean.home), fs.realpathSync(path.join(parent, 'run-1')));
    assert.equal(links(realAuth), 2);
    assert.equal(lean.dispose(), null);
  } finally {
    process.chdir(cwd);
  }
});

test('a real home with no `auth.json` is an error that says Codex is not logged in, and nothing is left behind', () => {
  const { realHome, parent } = homes({ login: null });
  assert.throws(() => createLeanHome({ realHome, parent, id: 'run-1' }), (err) => {
    assert.match(err.message, /not logged in/);
    assert.match(err.message, /codex login/);
    assert.ok(err.message.includes(path.join(realHome, 'auth.json')), err.message);
    return true;
  });
  assert.equal(fs.existsSync(path.join(parent, 'run-1')), false);
});

test('a login that is not a file is refused', () => {
  const { realHome, realAuth, parent } = homes({ login: null });
  fs.mkdirSync(realAuth);
  assert.throws(() => createLeanHome({ realHome, parent, id: 'run-1' }), /not a file/);
  assert.equal(fs.existsSync(path.join(parent, 'run-1')), false);
});

test('a link that fails names both paths and the code, says that no copy is made, and leaves nothing behind', () => {
  for (const code of ['EXDEV', 'EPERM', 'EMLINK']) {
    const { realHome, realAuth, parent } = homes();
    const link = () => {
      throw Object.assign(new Error(`${code}: link failed`), { code });
    };
    assert.throws(() => createLeanHome({ realHome, parent, id: 'run-1', link }), (err) => {
      assert.ok(err.message.includes(realAuth), err.message);
      assert.ok(err.message.includes(path.join(parent, 'run-1', 'auth.json')), err.message);
      assert.ok(err.message.includes(code), err.message);
      assert.match(err.message, /no copy is made/i);
      if (code === 'EXDEV') assert.match(err.message, /volume/);
      return true;
    });
    assert.equal(fs.existsSync(path.join(parent, 'run-1')), false, 'the partly made folder is removed');
    assert.equal(fs.existsSync(path.dirname(parent)), false, 'and so are the folders made to hold it');
    assert.equal(links(realAuth), 1);
    assert.equal(read(realAuth), LOGIN);
  }
});

test('a "link" that made another file is refused: a copy would let a refresh leave the real login stale', () => {
  const { realHome, realAuth, parent } = homes();
  assert.throws(() => createLeanHome({ realHome, parent, id: 'run-1', link: (from, to) => fs.copyFileSync(from, to) }), /not the same file/);
  assert.equal(fs.existsSync(path.join(parent, 'run-1')), false, 'the copy is removed with the folder');
  assert.equal(links(realAuth), 1);
  assert.equal(read(realAuth), LOGIN);
});

test('an id that could name anything but one folder under the parent is refused, and nothing is made', () => {
  const { realHome, realAuth, parent } = homes();
  for (const id of ['', '.', '..', '../x', 'a/b', 'a\\b', 'C:x', ' x', undefined, 7]) {
    assert.throws(() => createLeanHome({ realHome, parent, id }), /id/, JSON.stringify(id));
  }
  assert.equal(fs.existsSync(parent), false);
  assert.equal(links(realAuth), 1);
});

test('a folder that is already there is never taken over: the error names it and it is left as it was', () => {
  const { realHome, realAuth, parent } = homes();
  const taken = path.join(parent, 'run-1');
  fs.mkdirSync(taken, { recursive: true });
  fs.writeFileSync(path.join(taken, 'theirs.txt'), 'kept', 'utf8');
  assert.throws(() => createLeanHome({ realHome, parent, id: 'run-1' }), (err) => err.message.includes(taken));
  assert.equal(read(path.join(taken, 'theirs.txt')), 'kept');
  assert.equal(links(realAuth), 1);
});

// --- disposing of it ---

test('dispose removes the folder and one name of the login, never the login: same bytes, one link again', () => {
  const { realHome, realAuth, parent } = homes();
  const before = identity(realAuth);
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  codexWrites(lean.home);
  assert.equal(lean.dispose(), null);
  assert.equal(fs.existsSync(lean.home), false);
  assert.equal(fs.existsSync(realAuth), true);
  assert.equal(read(realAuth), LOGIN);
  assert.equal(links(realAuth), 1);
  assert.equal(identity(realAuth), before);
  assert.deepEqual(fs.readdirSync(realHome), ['auth.json'], 'nothing was written into the real home');
});

test('dispose is idempotent', () => {
  const { realHome, realAuth, parent } = homes();
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  assert.equal(lean.dispose(), null);
  assert.equal(lean.dispose(), null);
  assert.equal(links(realAuth), 1);
});

test('dispose({ keep: true }) removes the login\'s second name and nothing else: the folder and what Codex wrote in it stay', () => {
  const { realHome, realAuth, parent } = homes();
  const before = identity(realAuth);
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  codexWrites(lean.home);
  assert.equal(links(realAuth), 2);
  assert.equal(lean.dispose({ keep: true }), null);
  // The login: its own name alone again, the file it was, with its bytes.
  assert.equal(links(realAuth), 1);
  assert.equal(identity(realAuth), before);
  assert.equal(read(realAuth), LOGIN);
  // The lean home: there, without the login.
  assert.deepEqual(fs.readdirSync(lean.home).sort(), ['log', 'sessions', 'version.json']);
  assert.equal(read(path.join(lean.home, 'sessions', '2026', '10', 'rollout.jsonl')), '{}\n');
  assert.equal(read(path.join(lean.home, 'log', 'codex-tui.log')), 'line\n');
  assert.equal(lean.dispose({ keep: true }), null, 'kept twice is kept');
  assert.equal(fs.existsSync(lean.home), true);
  // A kept folder is not kept for ever: a plain dispose removes it, and so does the sweep once it is old.
  assert.equal(lean.dispose(), null);
  assert.equal(fs.existsSync(lean.home), false);
  assert.equal(links(realAuth), 1);
});

test('a kept lean home is removed by the sweep like one a killed run left', () => {
  const { realHome, realAuth, parent } = homes();
  const now = Date.parse('2026-10-07T12:00:00.000Z');
  const lean = createLeanHome({ realHome, parent, id: 'kept' });
  codexWrites(lean.home);
  assert.equal(lean.dispose({ keep: true }), null);
  aged(lean.home, now - 2000);
  assert.equal(sweepStaleLeanHomes(parent, { olderThanMs: 1000, now }), 1);
  // It was the last one there, so the sweep leaves no folder for the homes either, nor a state dir.
  assert.equal(fs.existsSync(path.dirname(parent)), false);
  assert.equal(links(realAuth), 1);
  assert.equal(read(realAuth), LOGIN);
});

// --- what a machine keeps after a run: nothing ---

/** The harness's state dir of `parent`, `<home>/.js-harness`, and the home it is in. */
const stateOf = (parent) => ({ state: path.dirname(parent), home: path.dirname(path.dirname(parent)) });

test('after the last home goes, the folder that held the homes goes too, and `.js-harness` when that leaves it empty; a home is made again from nothing', () => {
  const { realHome, realAuth, parent } = homes();
  const { state, home } = stateOf(parent);
  assert.equal(path.basename(state), '.js-harness');
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  codexWrites(lean.home);
  assert.equal(lean.dispose(), null);
  assert.equal(fs.existsSync(parent), false, 'no empty folder of homes is left');
  assert.equal(fs.existsSync(state), false, 'nor an empty state dir');
  assert.deepEqual(fs.readdirSync(home), [], 'the home it was in is never removed');
  assert.equal(lean.dispose(), null, 'and a second dispose finds nothing to do');
  // The next run finds neither folder, and makes both again.
  const next = createLeanHome({ realHome, parent, id: 'run-2' });
  assert.deepEqual(fs.readdirSync(parent), ['run-2']);
  assert.equal(links(realAuth), 2);
  assert.equal(next.dispose(), null);
  assert.equal(fs.existsSync(state), false);
  assert.equal(links(realAuth), 1);
});

test('the folder of the homes and `.js-harness` stay, untouched, while they hold anything else', () => {
  // Another run's home: the folder goes with the last of them, not with the first.
  const two = homes();
  const first = createLeanHome({ realHome: two.realHome, parent: two.parent, id: 'run-1' });
  const second = createLeanHome({ realHome: two.realHome, parent: two.parent, id: 'run-2' });
  assert.equal(first.dispose(), null);
  assert.deepEqual(fs.readdirSync(two.parent), ['run-2']);
  assert.equal(fs.existsSync(path.join(second.home, 'auth.json')), true, 'the other run still has its login');
  assert.equal(second.dispose(), null);
  assert.equal(fs.existsSync(stateOf(two.parent).state), false);

  // A file beside the folder of the homes, as the manifest of an installed harness is: the state dir stays.
  const installed = homes();
  const { state } = stateOf(installed.parent);
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, 'manifest.json'), '{}', 'utf8');
  assert.equal(createLeanHome({ realHome: installed.realHome, parent: installed.parent, id: 'run-1' }).dispose(), null);
  assert.deepEqual(fs.readdirSync(state), ['manifest.json'], 'the folder of the homes is gone, and nothing else');
  assert.equal(read(path.join(state, 'manifest.json')), '{}');

  // Something that is no home in the folder of the homes: that folder stays, with it.
  const noted = homes();
  fs.mkdirSync(noted.parent, { recursive: true });
  fs.writeFileSync(path.join(noted.parent, 'note.txt'), 'theirs', 'utf8');
  assert.equal(createLeanHome({ realHome: noted.realHome, parent: noted.parent, id: 'run-1' }).dispose(), null);
  assert.deepEqual(fs.readdirSync(noted.parent), ['note.txt']);
  assert.equal(read(path.join(noted.parent, 'note.txt')), 'theirs');
});

test('a kept home keeps its folders: nothing above it is removed until it goes', () => {
  const { realHome, parent } = homes();
  const lean = createLeanHome({ realHome, parent, id: 'kept' });
  codexWrites(lean.home);
  assert.equal(lean.dispose({ keep: true }), null);
  assert.deepEqual(fs.readdirSync(parent), ['kept']);
  assert.equal(lean.dispose(), null);
  assert.equal(fs.existsSync(stateOf(parent).state), false);
});

test('only `.js-harness` is ever removed above the folder of the homes: under another name that folder stays, empty or not', () => {
  const { root, realHome } = homes();
  const parent = path.join(root, 'elsewhere', 'homes');
  assert.equal(createLeanHome({ realHome, parent, id: 'run-1' }).dispose(), null);
  assert.equal(fs.existsSync(parent), false, 'the folder made for the homes goes when it is empty');
  assert.deepEqual(fs.readdirSync(path.join(root, 'elsewhere')), [], 'and what is above it is not the harness\'s to remove');
});

test('a folder of the homes that cannot be removed is nothing to say: dispose does not throw, and says what it would have', () => {
  const { realHome, realAuth, parent } = homes();
  const tried = [];
  for (const code of ['EBUSY', 'EPERM', 'ENOTEMPTY']) {
    const rmdir = (dir) => {
      tried.push(dir);
      throw Object.assign(new Error(`${code}: rmdir failed`), { code });
    };
    const lean = createLeanHome({ realHome, parent, id: `run-${code}`, rmdir });
    let said;
    assert.doesNotThrow(() => { said = lean.dispose(); });
    assert.equal(said, null, code);
    assert.equal(fs.existsSync(lean.home), false, 'the home itself is gone all the same');
    assert.deepEqual(fs.readdirSync(parent), [], 'the folder is left as it is');
  }
  // The folder of the homes is tried, and once it did not go nothing above it is.
  assert.deepEqual(tried, [parent, parent, parent]);
  assert.equal(links(realAuth), 1);
});

test('dispose({ keep: true }) says when the lean name had become another file, and still removes that name alone', () => {
  const { realHome, realAuth, parent } = homes();
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  const leanAuth = path.join(lean.home, 'auth.json');
  fs.writeFileSync(`${leanAuth}.tmp`, 'FIXTURE login written to a new file\n', 'utf8');
  fs.renameSync(`${leanAuth}.tmp`, leanAuth);
  codexWrites(lean.home);
  assert.match(lean.dispose({ keep: true }), /another file/);
  assert.equal(fs.existsSync(leanAuth), false, 'a kept folder never holds a login, the real one or another');
  assert.equal(fs.existsSync(path.join(lean.home, 'version.json')), true);
  assert.equal(read(realAuth), LOGIN);
  assert.equal(links(realAuth), 1);
});

test('a login rewritten in place through the lean name is the real login: the new bytes stay after dispose', () => {
  const { realHome, realAuth, parent } = homes();
  const before = identity(realAuth);
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  codexWrites(lean.home);
  // As Codex saves it: the same path opened for writing and truncated, not a new file renamed over it.
  const refreshed = 'FIXTURE login after a refresh, longer than the first one\n';
  fs.writeFileSync(path.join(lean.home, 'auth.json'), refreshed, { encoding: 'utf8', flag: 'w' });
  assert.equal(read(realAuth), refreshed, 'both names hold the new bytes at once');
  assert.equal(lean.dispose(), null);
  assert.equal(read(realAuth), refreshed);
  assert.equal(links(realAuth), 1);
  assert.equal(identity(realAuth), before, 'still the file it was');
});

test('a lean name that became another file is said by dispose: what was written there did not reach the real login', () => {
  const { realHome, realAuth, parent } = homes();
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  const leanAuth = path.join(lean.home, 'auth.json');
  // The other way to save a file: write a new one and rename it over the name.
  fs.writeFileSync(`${leanAuth}.tmp`, 'FIXTURE login written to a new file\n', 'utf8');
  fs.renameSync(`${leanAuth}.tmp`, leanAuth);
  const said = lean.dispose();
  assert.equal(typeof said, 'string');
  assert.match(said, /another file/);
  assert.ok(said.includes(realAuth), said);
  assert.equal(fs.existsSync(lean.home), false, 'the folder is removed all the same');
  assert.equal(read(realAuth), LOGIN, 'the real login is as it was');
  assert.equal(links(realAuth), 1);
  assert.equal(lean.dispose(), null, 'and it is said once');
});

test('dispose never throws: a folder that cannot be removed is a message that names it, with the login\'s second name already gone', () => {
  const { realHome, realAuth, parent } = homes();
  const rm = () => {
    throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
  };
  const lean = createLeanHome({ realHome, parent, id: 'run-1', rm });
  codexWrites(lean.home);
  let said;
  assert.doesNotThrow(() => { said = lean.dispose(); });
  assert.equal(typeof said, 'string');
  assert.ok(said.includes(lean.home), said);
  assert.ok(said.includes('EBUSY'), said);
  assert.equal(fs.existsSync(path.join(lean.home, 'auth.json')), false, 'the link goes first');
  assert.equal(links(realAuth), 1);
  assert.equal(read(realAuth), LOGIN);
});

// --- the folders a killed run left ---

/** Sets the date a folder was last changed. */
function aged(dir, mtimeMs) {
  fs.utimesSync(dir, new Date(mtimeMs), new Date(mtimeMs));
  return dir;
}

test('sweepStaleLeanHomes removes the run folders older than the bound, the login\'s name first, and counts them', () => {
  const { realHome, realAuth, parent } = homes();
  const now = Date.parse('2026-10-06T12:00:00.000Z');
  const hour = 60 * 60 * 1000;
  const killed = createLeanHome({ realHome, parent, id: 'killed' });
  codexWrites(killed.home);
  const older = createLeanHome({ realHome, parent, id: 'older' });
  const running = createLeanHome({ realHome, parent, id: 'running' });
  assert.equal(links(realAuth), 4);
  aged(killed.home, now - hour - 1);
  aged(older.home, now - 30 * hour);
  aged(running.home, now - hour + 1000);
  assert.equal(sweepStaleLeanHomes(parent, { olderThanMs: hour, now }), 2);
  assert.deepEqual(fs.readdirSync(parent), ['running'], 'a younger folder may be a review that is running');
  assert.equal(links(realAuth), 2, 'the login keeps its own name and the running review\'s');
  assert.equal(read(realAuth), LOGIN);
  assert.equal(running.dispose(), null);
  assert.equal(links(realAuth), 1);
});

test('sweepStaleLeanHomes leaves alone what is not a folder, and a bound that is not a number removes nothing', () => {
  const { realHome, parent } = homes();
  const now = Date.parse('2026-10-06T12:00:00.000Z');
  const old = createLeanHome({ realHome, parent, id: 'old' });
  const note = path.join(parent, 'note.txt');
  fs.writeFileSync(note, 'not a home', 'utf8');
  fs.utimesSync(note, new Date(0), new Date(0));
  aged(old.home, 0);
  for (const olderThanMs of [undefined, Number.NaN, 'soon']) assert.equal(sweepStaleLeanHomes(parent, { olderThanMs, now }), 0);
  assert.equal(sweepStaleLeanHomes(parent, { olderThanMs: 1000, now }), 1);
  assert.deepEqual(fs.readdirSync(parent), ['note.txt']);
});

test('sweepStaleLeanHomes never throws: no folder yet, or a path that is a file, is nothing to remove', () => {
  const { root } = homes();
  assert.equal(sweepStaleLeanHomes(path.join(root, 'nowhere'), { olderThanMs: 0, now: Date.now() }), 0);
  const file = path.join(root, 'a-file');
  fs.writeFileSync(file, '', 'utf8');
  assert.equal(sweepStaleLeanHomes(file, { olderThanMs: 0, now: Date.now() }), 0);
  assert.equal(sweepStaleLeanHomes(path.join(root, 'nowhere')), 0);
});

// --- a seeded home: a copy of a configuration, for a session that is measured with the user's own ---

/** A seed as a comparison gives one: it writes a configuration into the Codex home it is handed. */
const configSeed = (seen = {}) => ({ folder, home }) => {
  Object.assign(seen, { folder, home, entries: fs.readdirSync(home) });
  fs.writeFileSync(path.join(home, 'config.toml'), 'model = "x"\n', 'utf8');
  fs.mkdirSync(path.join(folder, '.engram'));
  return { env: { ENGRAM_PORT: '45678' } };
};

test('with a seed the run folder is a home directory: the Codex home is its `.codex`, seeded first and given the login last, as a hard link', () => {
  const { realHome, realAuth, parent } = homes();
  const seen = {};
  const seeded = createLeanHome({ realHome, parent, id: 'run-1', seed: configSeed(seen) });
  assert.equal(seeded.folder, path.join(parent, 'run-1'));
  assert.equal(seeded.home, path.join(parent, 'run-1', '.codex'));
  assert.deepEqual(seen, { folder: seeded.folder, home: seeded.home, entries: [] }, 'the seed runs in a home that holds no login yet, so it can never write through the link');
  assert.deepEqual(seeded.seeded, { env: { ENGRAM_PORT: '45678' } }, 'what the seed returned is handed on');
  assert.deepEqual(fs.readdirSync(seeded.home).sort(), ['auth.json', 'config.toml']);
  assert.equal(identity(path.join(seeded.home, 'auth.json')), identity(realAuth), 'the same file as the real login, not a copy');
  assert.equal(links(realAuth), 2);
  assert.deepEqual(fs.readdirSync(realHome), ['auth.json'], 'nothing is written into the real Codex home');
  // The whole run folder goes, the login's name first, and the login stays.
  assert.equal(seeded.dispose(), null);
  assert.equal(fs.existsSync(path.dirname(parent)), false, 'with the folder it was in, and the state dir');
  assert.equal(links(realAuth), 1);
  assert.equal(read(realAuth), LOGIN);
});

test('without a seed the folder and the home are one, as they were', () => {
  const { realHome, parent } = homes();
  const lean = createLeanHome({ realHome, parent, id: 'run-1' });
  assert.equal(lean.folder, lean.home);
  assert.equal(lean.seeded, undefined);
  assert.deepEqual(fs.readdirSync(lean.home), ['auth.json']);
  lean.dispose();
});

test('a seed that left an `auth.json` is refused: a copy of the login is never used, and the real one is not written through', () => {
  const { realHome, realAuth, parent } = homes();
  const copies = ({ home }) => fs.writeFileSync(path.join(home, 'auth.json'), 'a copy', 'utf8');
  assert.throws(() => createLeanHome({ realHome, parent, id: 'run-1', seed: copies }), /auth\.json.*copy/);
  assert.equal(fs.existsSync(path.dirname(parent)), false, 'nothing is left behind, not the folders made for it either');
  assert.equal(read(realAuth), LOGIN);
  assert.equal(links(realAuth), 1);
});

test('a seed that throws leaves nothing behind, and its reason is the error', () => {
  const { realHome, realAuth, parent } = homes();
  const fails = ({ home }) => {
    fs.writeFileSync(path.join(home, 'config.toml'), 'half', 'utf8');
    throw new Error('the template is gone');
  };
  assert.throws(() => createLeanHome({ realHome, parent, id: 'run-1', seed: fails }), /the template is gone/);
  assert.equal(fs.existsSync(path.dirname(parent)), false);
  assert.equal(links(realAuth), 1);
});

test('the sweep removes a seeded home a killed run left, the login\'s name first: the login keeps its bytes and its one name', () => {
  const { realHome, realAuth, parent } = homes();
  const now = Date.parse('2026-10-06T12:00:00.000Z');
  const rm = [];
  const killed = createLeanHome({ realHome, parent, id: 'killed', seed: configSeed() });
  assert.equal(links(realAuth), 2);
  aged(killed.folder, now - 2000);
  // What the recursive removal is handed no longer holds a name of the login.
  const watched = fs.rmSync;
  fs.rmSync = (target, options) => {
    rm.push({ target, loginThere: fs.existsSync(path.join(target, '.codex', 'auth.json')) });
    return watched(target, options);
  };
  try {
    assert.equal(sweepStaleLeanHomes(parent, { olderThanMs: 1000, now }), 1);
  } finally {
    fs.rmSync = watched;
  }
  assert.deepEqual(rm, [{ target: killed.folder, loginThere: false }]);
  assert.equal(fs.existsSync(path.dirname(parent)), false, 'the last home there, so its folders go with it');
  assert.equal(links(realAuth), 1);
  assert.equal(read(realAuth), LOGIN);
});

test('a seeded home that cannot be removed is a message, with the login\'s name already gone from its `.codex`', () => {
  const { realHome, realAuth, parent } = homes();
  const rm = () => {
    throw Object.assign(new Error('busy'), { code: 'EBUSY' });
  };
  const seeded = createLeanHome({ realHome, parent, id: 'run-1', seed: configSeed(), rm });
  const left = seeded.dispose();
  assert.match(left, /could not remove/);
  assert.ok(left.includes(seeded.folder), left);
  assert.equal(fs.existsSync(path.join(seeded.home, 'auth.json')), false);
  assert.equal(fs.existsSync(path.join(seeded.home, 'config.toml')), true);
  assert.equal(links(realAuth), 1);
});
