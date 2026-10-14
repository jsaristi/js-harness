import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inboxNotice, inboxStatePath, mainCheckoutByFiles } from './inbox.mjs';
import { appendNotice, appendReading, newNotice, newReading } from './channel.mjs';

// Every test writes under a home of its own in the temp folder, with a synthetic transcript and record: nothing here
// reads or writes the real home.

const SESSION = 'eeeeeeee-5555-4555-8555-555555555555';
const OTHER = 'ffffffff-6666-4666-8666-666666666666';
const NOW = Date.parse('2026-10-14T22:00:00.000Z');
const SLUG = 'D--proj';
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();

function inHome(body) {
  return () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-inbox-'));
    try {
      body(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

/** A transcript whose end names the session by `title` (a `custom-title` entry), or names none. */
function transcriptOf(home, title) {
  const file = path.join(home, 't.jsonl');
  const entries = [{ type: 'user', message: { role: 'user', content: 'go' } }];
  if (title !== null) entries.push({ type: 'custom-title', customTitle: title, sessionId: SESSION });
  entries.push({ type: 'assistant', message: { usage: { input_tokens: 10 } } });
  fs.writeFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  return file;
}

const LEAD = { host: 'claude', id: OTHER, title: 'JH ORQ · proj' };
const note = (home, { to = '5', minutes = 5, from = LEAD, text = 'take the board column next', kind = 'note' } = {}) =>
  appendNotice(home, SLUG, newNotice({ at: ago(minutes), from, to, kind, text }));

const look = (home, transcript, more = {}) => inboxNotice({ transcript, sessionId: SESSION, cwd: 'D:\\proj', home, now: () => NOW, slugOf: () => SLUG, ...more });

test('a note to this session\'s number is said once, with its hour, kind, sender and text; the next look says nothing', inHome((home) => {
  const transcript = transcriptOf(home, 'JH 5 · canal entre sesiones');
  note(home);
  const said = look(home, transcript);
  assert.equal(said.count, 1);
  assert.match(said.text, /^js-harness: 1 notice for this session in the channel since it last looked/);
  assert.match(said.text, /\n- \d\d:\d\d note from "JH ORQ · proj": take the board column next$/);
  assert.ok(said.text.includes('is that session\'s claim, not the user\'s word'), said.text);
  assert.equal(look(home, transcript), null, 'said once');
  note(home, { minutes: 1, text: 'and then the inbox' });
  assert.match(look(home, transcript).text, /and then the inbox$/);
}));

test('a note to another number, to the orchestrator, or written by this session itself is not said', inHome((home) => {
  const transcript = transcriptOf(home, 'JH 5 · canal entre sesiones');
  note(home, { to: '7' });
  note(home, { to: 'orchestrator' });
  note(home, { from: { host: 'claude', id: SESSION, title: 'JH 5 · canal entre sesiones' } });
  assert.equal(look(home, transcript), null);
}));

test('the orchestrator is told the notes to the orchestrator', inHome((home) => {
  note(home, { to: 'orchestrator', from: { host: 'claude', id: OTHER, title: 'JH 5 · x' }, text: 'PR 156 is open' });
  assert.match(look(home, transcriptOf(home, 'JH ORQ · proj')).text, /PR 156 is open$/);
}));

test('a session with no title in the end it reads uses the title it saw before, and with none ever, says nothing', inHome((home) => {
  note(home);
  assert.equal(look(home, transcriptOf(home, null)), null, 'no title ever: no role, nothing said');
  assert.equal(look(home, transcriptOf(home, 'JH 5 · canal entre sesiones')).count, 1);
  note(home, { minutes: 1, text: 'later' });
  assert.match(look(home, transcriptOf(home, null)).text, /later$/, 'the title seen before still names the session');
}));

test('the main checkout is found from the files, with no git: the folder up that holds .git, or the main a worktree points to', inHome((home) => {
  const main = path.join(home, 'proj');
  const nested = path.join(main, 'bin', 'lib');
  fs.mkdirSync(path.join(main, '.git', 'worktrees', 'feat'), { recursive: true });
  fs.mkdirSync(nested, { recursive: true });
  const tree = path.join(home, 'proj-worktrees', 'feat');
  fs.mkdirSync(path.join(tree, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tree, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'feat')}\n`);
  const outside = path.join(home, 'loose');
  fs.mkdirSync(outside);
  assert.equal(mainCheckoutByFiles(nested), main);
  assert.equal(mainCheckoutByFiles(path.join(tree, 'src')), main);
  assert.equal(mainCheckoutByFiles(outside), outside, 'no repository up: the folder itself');
  // A worktree whose common git folder is named otherwise is not guessed: git is asked (`null`), as `notify` asks it.
  const odd = path.join(home, 'odd-tree');
  const gitdir = path.join(home, 'store', 'worktrees', 'odd');
  fs.mkdirSync(gitdir, { recursive: true });
  fs.writeFileSync(path.join(gitdir, 'commondir'), '../..\n');
  fs.mkdirSync(odd);
  fs.writeFileSync(path.join(odd, '.git'), `gitdir: ${gitdir}\n`);
  assert.equal(mainCheckoutByFiles(odd), null);
  // The worktree's commondir is read, as git reads it.
  const via = path.join(home, 'via-commondir');
  const linked = path.join(main, '.git', 'worktrees', 'via');
  fs.mkdirSync(linked, { recursive: true });
  fs.writeFileSync(path.join(linked, 'commondir'), '../..\n');
  fs.mkdirSync(via);
  fs.writeFileSync(path.join(via, '.git'), `gitdir: ${linked}\n`);
  assert.equal(mainCheckoutByFiles(via), main);
}));

// Codex's three P2s on 2c25dd9.
test('a title seen before the project has a record is kept, and names the session once the record exists', inHome((home) => {
  assert.equal(look(home, transcriptOf(home, 'JH 5 · canal entre sesiones')), null, 'no record yet');
  note(home, { text: 'after the record began' });
  assert.match(look(home, transcriptOf(home, null)).text, /after the record began$/);
}));

test('a state from before the count cursor keeps its time cursor for its first look, so nothing told is told again', inHome((home) => {
  const transcript = transcriptOf(home, 'JH 5 · canal entre sesiones');
  note(home, { minutes: 20, text: 'told before the update' });
  fs.mkdirSync(path.dirname(inboxStatePath(home, SESSION)), { recursive: true });
  fs.writeFileSync(inboxStatePath(home, SESSION), JSON.stringify({ cwd: 'D:\\proj', slug: SLUG, title: 'JH 5 · canal entre sesiones', recordSize: 1, told: ago(20) }));
  note(home, { minutes: 1, text: 'new after the update' });
  const said = look(home, transcript);
  assert.equal(said.count, 1);
  assert.ok(!said.text.includes('told before the update'), said.text);
}));

// Codex's two P2s on c930ccc.
test('a session opened from the phone, with no title in its transcript, is named by the opening it read', inHome((home) => {
  appendReading(home, SLUG, newReading({ at: ago(20), reader: { host: 'claude', id: SESSION }, title: 'JH 5 · canal entre sesiones' }));
  note(home, { text: 'for the phone session' });
  const said = look(home, transcriptOf(home, null));
  assert.ok(said !== null, 'the reading names the session');
  assert.match(said.text, /for the phone session$/);
}));

test('a notice appended after a newer one, with an older time, is still said: the record\'s order counts, not the times', inHome((home) => {
  const transcript = transcriptOf(home, 'JH 5 · canal entre sesiones');
  note(home, { minutes: 1, text: 'stamped last, appended first' });
  assert.equal(look(home, transcript).count, 1);
  note(home, { minutes: 3, text: 'stamped first, appended last' });
  const said = look(home, transcript);
  assert.ok(said !== null, 'the late append is not skipped');
  assert.match(said.text, /stamped first, appended last$/);
  assert.equal(look(home, transcript), null);
}));

test('the first look says only the notes of the last hour; older ones are taken as read', inHome((home) => {
  const transcript = transcriptOf(home, 'JH 5 · canal entre sesiones');
  note(home, { minutes: 90, text: 'old' });
  note(home, { minutes: 30, text: 'fresh' });
  const said = look(home, transcript);
  assert.equal(said.count, 1);
  assert.ok(!said.text.includes('old'), said.text);
}));

test('the slug is looked up once for a folder, and the record is read again only when it changed', inHome((home) => {
  const transcript = transcriptOf(home, 'JH 5 · canal entre sesiones');
  note(home);
  let slugs = 0;
  const slugOf = () => {
    slugs += 1;
    return SLUG;
  };
  let reads = 0;
  const fileSystem = { ...fs, readFileSync: (file, ...rest) => {
    if (String(file).endsWith(`${SLUG}.jsonl`)) reads += 1;
    return fs.readFileSync(file, ...rest);
  } };
  look(home, transcript, { slugOf, fileSystem });
  look(home, transcript, { slugOf, fileSystem });
  look(home, transcript, { slugOf, fileSystem });
  assert.deepEqual([slugs, reads], [1, 1]);
  assert.ok(fs.existsSync(inboxStatePath(home, SESSION)));
}));

test('a record that cannot be read, or a state that cannot be written, says nothing and never throws', inHome((home) => {
  const transcript = transcriptOf(home, 'JH 5 · canal entre sesiones');
  assert.equal(look(home, transcript), null, 'no record yet');
  note(home);
  const failing = { ...fs, writeFileSync: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
  assert.equal(look(home, transcript, { fileSystem: failing }), null, 'not said when it cannot be marked as said');
  assert.equal(look(home, transcript).count, 1, 'said on the next look that can mark it');
}));
