import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { IDLE_MARKER, IDLE_MS, idleSpellsFile, readIdleSpells, stretchIdle } from './lead-away.mjs';
import { gateLogDir } from './gate-log.mjs';
import { loopsFolder } from './loops.mjs';
import { stretchRecordsIn } from './return-report.mjs';
import { RECORD_SCHEMA as STRETCH_SCHEMA, stretchFile } from './stretch.mjs';

// The lead's idle reading (odd/tasks/idle-stretch.md): while a stretch is open with hours left, no work session of
// the project has written for IDLE_MS. Every seam is fake: the files' times, the folders' listings and the records.
const T0 = Date.parse('2026-11-22T03:52:00.000Z');
const MIN = 60_000;
const HOUR = 60 * MIN;
const HOME = path.resolve('lead-away-test-home');
const SLUG = 'D--lead-away-test';
const LEAD = 'aaaaaaaa-1111-4111-8111-111111111111';
const DIR = path.resolve('lead-away-test-claude', 'projects', SLUG);
const TREE_DIR = path.resolve('lead-away-test-claude', 'projects', `${SLUG}--worktree`);
const GATES = gateLogDir(HOME);
const STRETCHES = stretchFile(HOME, SLUG);
const MARK = path.join(loopsFolder(HOME, SLUG), 'idle', `${LEAD}.json`);
const iso = (ms) => new Date(ms).toISOString();
const opened = (at, hours = 9) => `${JSON.stringify({ schema: STRETCH_SCHEMA, event: 'open', id: iso(at), at: iso(at), plan: { hours } })}\n`;
const closed = (id, at) => `${JSON.stringify({ schema: STRETCH_SCHEMA, event: 'close', id: iso(id), at: iso(at) })}\n`;

/** A world of `files` (a path to its time in ms) and `records` (a path to its text), and the reading over it. */
function world({ files = {}, records = {}, dirs = [DIR, TREE_DIR], unreadable = {} } = {}) {
  const state = { files: { ...files }, records: { ...records }, said: [] };
  const enoent = (file) => Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
  const reading = stretchIdle({
    home: HOME,
    slug: SLUG,
    session: LEAD,
    dirs: () => dirs,
    readdir: (dir) => {
      if (unreadable[dir]) throw Object.assign(new Error(`${unreadable[dir]}: ${dir}`), { code: unreadable[dir] });
      // A folder lists its files and the folders that hold files further down, as a real listing does.
      const names = [...new Set(Object.keys(state.files).map((file) => path.relative(dir, file)).filter((rel) => rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)).map((rel) => rel.split(path.sep)[0]))];
      if (names.length === 0) throw enoent(dir);
      return names;
    },
    mtime: (file) => {
      if (state.files[file] === undefined) throw enoent(file);
      return state.files[file];
    },
    readFile: (file) => {
      if (state.records[file] === undefined) throw enoent(file);
      return state.records[file];
    },
    writeFile: (file, text) => {
      state.records[file] = text;
    },
    say: (line) => state.said.push(line),
  });
  return { state, reading };
}

test('a stretch open with hours left and no work session written for IDLE_MS is idle, since the newest write', () => {
  const { reading } = world({
    files: { [path.join(DIR, 'work-1.jsonl')]: T0 - 30 * MIN, [path.join(TREE_DIR, 'work-2.jsonl')]: T0 - 25 * MIN },
    records: { [STRETCHES]: opened(T0 - 3 * HOUR) },
  });
  assert.equal(IDLE_MS, 20 * MIN);
  assert.deepEqual(reading.at(T0), { since: iso(T0 - 25 * MIN), idleMs: 25 * MIN, stretch: iso(T0 - 3 * HOUR), leftMs: 6 * HOUR });
});

test('a write under IDLE_MS ago, by a session of any of the project folders or by a gate, is not idle', () => {
  const stretch = { [STRETCHES]: opened(T0 - 3 * HOUR) };
  assert.equal(world({ files: { [path.join(TREE_DIR, 'work-2.jsonl')]: T0 - 19 * MIN }, records: stretch }).reading.at(T0), null);
  assert.equal(world({ files: { [path.join(GATES, 'log.jsonl')]: T0 - 5 * MIN }, records: stretch }).reading.at(T0), null);
});

test("the lead's own transcript does not count as a work session's write, and a file that is not a transcript neither", () => {
  const { reading } = world({
    files: { [path.join(DIR, `${LEAD}.jsonl`)]: T0 - MIN, [path.join(DIR, 'notes.txt')]: T0 - MIN, [path.join(DIR, 'work-1.jsonl')]: T0 - HOUR },
    records: { [STRETCHES]: opened(T0 - 3 * HOUR) },
  });
  assert.equal(reading.at(T0)?.since, iso(T0 - HOUR));
});

test('the idle time is counted from the opening of the stretch when nothing was written after it', () => {
  const { reading } = world({ files: { [path.join(DIR, 'work-1.jsonl')]: T0 - 5 * HOUR }, records: { [STRETCHES]: opened(T0 - 21 * MIN) } });
  assert.equal(reading.at(T0)?.since, iso(T0 - 21 * MIN));
  assert.equal(world({ records: { [STRETCHES]: opened(T0 - 19 * MIN) } }).reading.at(T0), null);
});

test('no stretch, a closed one, or one past its return is never idle', () => {
  const quiet = { [path.join(DIR, 'work-1.jsonl')]: T0 - 5 * HOUR };
  assert.equal(world({ files: quiet }).reading.at(T0), null);
  assert.equal(world({ files: quiet, records: { [STRETCHES]: opened(T0 - 3 * HOUR) + closed(T0 - 3 * HOUR, T0 - HOUR) } }).reading.at(T0), null);
  assert.equal(world({ files: quiet, records: { [STRETCHES]: opened(T0 - 3 * HOUR, 2) } }).reading.at(T0), null);
});

test('a folder that cannot be listed is unknown, not idle: said once, and nothing is told', () => {
  const { state, reading } = world({ records: { [STRETCHES]: opened(T0 - 3 * HOUR) }, unreadable: { [TREE_DIR]: 'EACCES' } });
  assert.equal(reading.at(T0), null);
  assert.equal(reading.at(T0 + MIN), null);
  assert.equal(state.said.length, 1);
  assert.match(state.said[0], /^the idle stretch could not be read: .*EACCES/);
});

test('an idle spell is told once with its IDLE line and its mark; new work and a new quiet make a new spell', () => {
  const work = path.join(DIR, 'work-1.jsonl');
  const { state, reading } = world({ files: { [work]: T0 - 30 * MIN }, records: { [STRETCHES]: opened(T0 - 3 * HOUR) } });
  const found = reading.at(T0);
  assert.equal(reading.told(), null);
  const line = reading.tell(found, T0);
  assert.ok(line.startsWith(`${IDLE_MARKER} no work session of this project has written since `));
  assert.match(line, /\(30 minutes ago\), and the stretch opened at \d\d:\d\d has 6\.0 hours left: plan the next unit or close the stretch/);
  assert.ok(line.includes('js-harness stretch close --html <file>'));
  assert.ok(line.endsWith('Told once for this idle spell.'));
  assert.deepEqual(JSON.parse(state.records[MARK]), { told: iso(T0 - 30 * MIN), at: iso(T0) });
  assert.equal(reading.told(), reading.at(T0 + MIN).since, 'the same spell is the one told');

  state.files[work] = T0 + 10 * MIN;
  assert.equal(reading.at(T0 + 20 * MIN), null);
  assert.notEqual(reading.at(T0 + 31 * MIN).since, reading.told());
});

test('a mark that cannot be written is said, and the line is still given', () => {
  const { state, reading } = world({ files: { [path.join(DIR, 'work-1.jsonl')]: T0 - 30 * MIN }, records: { [STRETCHES]: opened(T0 - 3 * HOUR) } });
  const failing = stretchIdle({ home: HOME, slug: SLUG, session: LEAD, dirs: () => [DIR], readdir: () => [], mtime: () => 0, readFile: () => '', writeFile: () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); }, say: (line) => state.said.push(line) });
  assert.ok(failing.tell(reading.at(T0), T0).startsWith(IDLE_MARKER));
  assert.match(state.said[0], /could not keep its mark .*EACCES/);
});

test("a stretch record gives each stretch's return: its opening plus its hours, or null without them", () => {
  const records = stretchRecordsIn(opened(T0, 4) + `${JSON.stringify({ schema: STRETCH_SCHEMA, event: 'open', id: 'x', at: iso(T0), plan: {} })}\n`);
  assert.equal(records[0].returnAt, T0 + 4 * HOUR);
  assert.equal(records[1].returnAt, null);
});

test('each spell told is added to the spells record, which a stretch\'s return reads; a torn line is left out', () => {
  const work = path.join(DIR, 'work-1.jsonl');
  const { state, reading } = world({ files: { [work]: T0 - 30 * MIN }, records: { [STRETCHES]: opened(T0 - 3 * HOUR) } });
  reading.tell(reading.at(T0), T0);
  state.files[work] = T0 + MIN;
  reading.tell(reading.at(T0 + 30 * MIN), T0 + 30 * MIN);
  state.records[idleSpellsFile(HOME, SLUG)] += '{"since": torn\n';
  assert.deepEqual(readIdleSpells(HOME, SLUG, (file) => state.records[file]), [
    { since: iso(T0 - 30 * MIN), at: iso(T0), session: LEAD },
    { since: iso(T0 + MIN), at: iso(T0 + 30 * MIN), session: LEAD },
  ]);
  assert.deepEqual(readIdleSpells(HOME, 'no-such-project', () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); }), []);
  assert.throws(() => readIdleSpells(HOME, SLUG, () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); }), /the idle spells .*EACCES/);
});

// JH 291, third unit: a foreground sub-agent writes only its own transcript, under its session's folder
// (`<project folder>/<session id>/subagents/agent-*.jsonl`, as the host lays it out), so its writes are work too.
test("a sub-agent's transcript written under IDLE_MS ago keeps the line silent; the lead's own sub-agent does not", () => {
  const stretch = { [STRETCHES]: opened(T0 - 3 * HOUR) };
  const parent = { [path.join(DIR, 'work-1.jsonl')]: T0 - HOUR };
  const working = { ...parent, [path.join(DIR, 'work-1', 'subagents', 'agent-a1.jsonl')]: T0 - 5 * MIN };
  assert.equal(world({ files: working, records: stretch, dirs: [DIR] }).reading.at(T0), null);
  const own = { ...parent, [path.join(DIR, LEAD, 'subagents', 'agent-a2.jsonl')]: T0 - 5 * MIN };
  assert.equal(world({ files: own, records: stretch, dirs: [DIR] }).reading.at(T0)?.since, iso(T0 - HOUR));
  // A session folder with no sub-agents is none.
  assert.equal(world({ files: { ...parent, [path.join(DIR, 'work-2', 'custom-title.json')]: T0 - MIN }, records: stretch, dirs: [DIR] }).reading.at(T0)?.since, iso(T0 - HOUR));
});
