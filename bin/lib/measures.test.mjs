import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keptByGitLog, keptByRelief, keptEither, measuresLines, measuresTotal } from './measures.mjs';
import { reliefStamp } from './channel.mjs';

// The kept reader is driven by a fake `run` shaped like spawnSync's result, and the lines by measures shaped
// like `compactionMeasures` gives them: nothing here runs git or reads a transcript.

const at = (minute) => `2026-01-01T10:${String(minute).padStart(2, '0')}:00.000Z`;
const ok = (stdout) => ({ status: 0, stdout, stderr: '' });

/** A fake `run` that answers `answer` and records every call. */
function recording(answer) {
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, options });
    return typeof answer === 'function' ? answer(command, args) : answer;
  };
  return { run, calls };
}

// --- keptByGitLog ---

test('keptByGitLog asks git for the commit times of the document alone, from its own folder, whichever slash the path has', () => {
  const windows = recording(ok(''));
  keptByGitLog(windows.run)({ document: 'C:\\proj\\odd\\tasks\\session-channel.md', after: at(3), before: at(6) });
  assert.deepEqual(windows.calls.map(({ command, args }) => [command, args]), [['git', ['-C', 'C:\\proj\\odd\\tasks', 'log', '--format=%cI', '--', 'session-channel.md']]]);
  const posix = recording(ok(''));
  keptByGitLog(posix.run)({ document: '/home/me/proj/odd/tasks/board.md', after: at(3), before: at(6) });
  assert.deepEqual(posix.calls.map(({ args }) => args), [['-C', '/home/me/proj/odd/tasks', 'log', '--format=%cI', '--', 'board.md']]);
});

test('keptByGitLog keeps the stretch when a commit of the document falls after the notice and at or before the boundary', () => {
  const kept = (stdout, after = at(3), before = at(6)) => keptByGitLog(recording(ok(stdout)).run)({ document: '/p/odd/tasks/x.md', after, before });
  assert.deepEqual(kept(`${at(5)}\n${at(1)}\n`), { known: true, kept: true });
  assert.deepEqual(kept(`${at(6)}\n`), { known: true, kept: true }, 'a commit at the boundary itself is before it');
  assert.deepEqual(kept(`${at(3)}\n`), { known: true, kept: false }, 'a commit at the notice is not after it');
  assert.deepEqual(kept(`${at(7)}\n${at(2)}\n`), { known: true, kept: false });
  assert.deepEqual(kept(''), { known: true, kept: false }, 'a document never committed was not kept');
});

test('keptByGitLog compares the times as instants: a commit time with an offset is read where it falls', () => {
  // 05:05 at UTC-05:00 is 10:05 UTC, inside the stretch from 10:03 to 10:06; read as text it would sort before it.
  const kept = keptByGitLog(recording(ok('2026-01-01T05:05:00-05:00\r\n')).run);
  assert.deepEqual(kept({ document: '/p/odd/tasks/x.md', after: at(3), before: at(6) }), { known: true, kept: true });
});

test('keptByGitLog reads a stretch with no start as open, and a commit time that does not parse proves nothing', () => {
  assert.deepEqual(keptByGitLog(recording(ok(`${at(1)}\n`)).run)({ document: '/p/odd/tasks/x.md', after: null, before: at(6) }), { known: true, kept: true });
  assert.deepEqual(keptByGitLog(recording(ok('not a time\n')).run)({ document: '/p/odd/tasks/x.md', after: null, before: at(6) }), { known: true, kept: false });
});

test('keptByGitLog knows nothing when git fails, cannot start, throws, or there is no document or no readable bound', () => {
  const unknown = { known: false };
  const query = { document: '/p/odd/tasks/x.md', after: at(3), before: at(6) };
  assert.deepEqual(keptByGitLog(recording({ status: 128, stdout: '', stderr: 'fatal: not a git repository' }).run)(query), unknown);
  assert.deepEqual(keptByGitLog(recording({ status: null, stdout: '', error: new Error('spawn git ENOENT') }).run)(query), unknown);
  assert.deepEqual(keptByGitLog(() => {
    throw new Error('boom');
  })(query), unknown);
  const never = recording(ok(`${at(5)}\n`));
  assert.deepEqual(keptByGitLog(never.run)({ ...query, document: null }), unknown);
  assert.deepEqual(keptByGitLog(never.run)({ ...query, document: '' }), unknown);
  assert.deepEqual(never.calls, [], 'no document, no git');
  assert.deepEqual(keptByGitLog(recording(ok(`${at(5)}\n`)).run)({ ...query, before: 'soon' }), unknown);
  assert.deepEqual(keptByGitLog(recording(ok(`${at(5)}\n`)).run)({ ...query, after: 'earlier' }), unknown);
});

// --- keptByRelief ---

/** A line of the relief file stamped at minute `minute` of the test's hour, as `notify --relief` writes it. */
const stampOf = (minute) => reliefStamp(Date.parse(at(minute)));
const RELIEF = '/home/me/.js-harness/relief/proj.md';

test('keptByRelief keeps the stretch when a line of the relief file is stamped after the notice and at or before the boundary', () => {
  const kept = (text, after = at(3), before = at(6)) => keptByRelief(() => text, RELIEF)({ after, before });
  assert.deepEqual(kept(`${stampOf(1)} earlier\n${stampOf(5)} inside\n`), { known: true, kept: true });
  assert.deepEqual(kept(`${stampOf(6)} at the boundary\n`), { known: true, kept: true }, 'a line at the boundary itself is before it');
  assert.deepEqual(kept(`${stampOf(3)} at the notice\n`), { known: true, kept: false }, 'a line at the notice is not after it');
  assert.deepEqual(kept(`${stampOf(7)} late\n${stampOf(2)} early\n`), { known: true, kept: false });
  assert.deepEqual(kept(''), { known: true, kept: false }, 'a relief file with no line of the stretch was not kept');
});

// Codex on edf9e75 and 60618c3: a stamp with minutes only cannot say which side of the notice's second it fell on.
// The command writes seconds now; an older line of the notice's or the boundary's minute is not known, never kept.
test('keptByRelief compares a stamp with seconds exactly, and calls a minute-only line of a bound minute not known', () => {
  const second = (minute, s) => new Date(Date.parse(at(minute)) + s * 1000).toISOString();
  const kept = (text) => keptByRelief(() => text, RELIEF)({ after: second(3, 10), before: second(6, 20) });
  const minuteOnly = (minute) => stampOf(minute).replace(/(\d{2}:\d{2}):\d{2} local/, '$1 local');
  const withSeconds = (minute, s) => reliefStamp(Date.parse(at(minute)) + s * 1000);
  assert.deepEqual(kept(`${withSeconds(3, 40)} after the notice, same minute\n`), { known: true, kept: true });
  assert.deepEqual(kept(`${withSeconds(3, 5)} before the notice, same minute\n`), { known: true, kept: false });
  assert.deepEqual(kept(`${withSeconds(6, 30)} after the boundary, same minute\n`), { known: true, kept: false });
  assert.deepEqual(kept(`${minuteOnly(3)} the notice's minute, no seconds\n`), { known: false });
  assert.deepEqual(kept(`${minuteOnly(6)} the boundary's minute, no seconds\n`), { known: false });
  assert.deepEqual(kept(`${minuteOnly(5)} inside, no seconds\n${minuteOnly(3)} ambiguous\n`), { known: true, kept: true });
  assert.deepEqual(kept(`${minuteOnly(2)} before\n${minuteOnly(7)} after\n`), { known: true, kept: false });
});

test('keptByRelief reads the stamp as the local time the line was written, in the same form the command writes, and a hand-written one too', () => {
  const handWritten = `${stampOf(5).replace('(notify)', '(date)')} hand-written\n`;
  assert.deepEqual(keptByRelief(() => handWritten, RELIEF)({ after: at(3), before: at(6) }), { known: true, kept: true });
});

test('keptByRelief ignores a line whose stamp does not parse, and reads a stretch with no start as open', () => {
  const noise = [
    '2026-01-01 orchestrator until now: a line with only its date',
    `${stampOf(5).replace(' local', '')} a stamp with no local time`,
    '2026-02-30 10:05 local (date). a day the calendar does not have',
    `note ${stampOf(5)} a line that starts with other text`,
    '2026-01-01 25:99 local (date). an hour the clock does not have',
  ].join('\n');
  assert.deepEqual(keptByRelief(() => `${noise}\n`, RELIEF)({ after: at(3), before: at(6) }), { known: true, kept: false }, 'no stamp that parses falls in the stretch');
  assert.deepEqual(keptByRelief(() => `${stampOf(1)} early\n`, RELIEF)({ after: null, before: at(6) }), { known: true, kept: true });
});

test('keptByRelief knows nothing when the file cannot be read, ENOENT included, or a bound does not parse', () => {
  const unknown = { known: false };
  const query = { after: at(3), before: at(6) };
  const missing = keptByRelief(() => {
    throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
  }, RELIEF);
  assert.deepEqual(missing(query), unknown);
  let reads = 0;
  const counted = keptByRelief(() => {
    reads += 1;
    return `${stampOf(5)} inside\n`;
  }, RELIEF);
  assert.deepEqual(counted({ ...query, before: 'soon' }), unknown);
  assert.deepEqual(counted({ ...query, after: 'earlier' }), unknown);
  assert.equal(reads, 0, 'a bound that does not parse is not read');
});

// --- keptEither ---

test('keptEither says kept when any known reader says kept, and kept false only when a reader is known and none says kept', () => {
  const query = { document: '/p/odd/tasks/x.md', after: at(3), before: at(6) };
  const yes = () => ({ known: true, kept: true });
  const no = () => ({ known: true, kept: false });
  const unknown = () => ({ known: false });
  assert.deepEqual(keptEither(unknown, yes)(query), { known: true, kept: true }, 'git unknown, the relief line kept');
  assert.deepEqual(keptEither(no, yes)(query), { known: true, kept: true });
  assert.deepEqual(keptEither(no, no)(query), { known: true, kept: false }, 'neither kept');
  assert.deepEqual(keptEither(unknown, no)(query), { known: true, kept: false }, 'one known and not kept is a miss');
  assert.deepEqual(keptEither(unknown, unknown)(query), { known: false }, 'none known is unknown');
  assert.deepEqual(keptEither(() => {
    throw new Error('boom');
  }, unknown)(query), { known: false }, 'a reader that throws is unknown, not a miss');
  assert.deepEqual(keptEither()(query), { known: false }, 'no reader is unknown');
});

// --- measuresLines ---

const asked = (minute) => ({ at: at(minute), automatic: false, inThisFile: true, verdict: null });
const elsewhere = (minute) => ({ at: at(minute), automatic: true, inThisFile: false, verdict: null });
const judged = (minute, { told, kept, announced }) => ({
  at: at(minute),
  automatic: true,
  inThisFile: true,
  verdict: { told, kept, announced, missing: ['told', 'kept', 'announced'].filter((name) => ({ told, kept, announced })[name] === false) },
});

const SESSION_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const SESSION_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const SESSION_C = 'cccccccc-3333-4333-8333-333333333333';
const SESSION_D = 'dddddddd-4444-4444-8444-444444444444';

test('measuresLines prints a block per session with a compaction, each compaction oldest first with its three facts, then the total', () => {
  const sessions = [
    { id: SESSION_A, title: 'JH 5 board', measures: [asked(6), judged(20, { told: true, kept: null, announced: false })] },
    { id: SESSION_B, title: 'nothing compacted', measures: [] },
    { id: SESSION_C, measures: [judged(40, { told: true, kept: true, announced: true }), elsewhere(30)] },
  ];
  assert.deepEqual(measuresLines(sessions), [
    'aaaaaaaa  JH 5 board',
    `  ${at(6)}  asked`,
    `  ${at(20)}  automatic  told yes  kept unknown  announced no`,
    SESSION_C,
    `  ${at(30)}  automatic  not judged: the stretch before it is not in this transcript`,
    `  ${at(40)}  automatic  told yes  kept yes  announced yes`,
    '2 automatic compactions judged in 2 sessions: 1 misses a fact (announced 1); 1 with a fact not known; 1 asked, not judged; 1 automatic not judged here',
  ]);
});

test('measuresLines names every fact missed with its count, and says a transcript that could not be read', () => {
  const sessions = [
    { id: SESSION_A, title: 'one', measures: [judged(10, { told: false, kept: null, announced: null }), judged(20, { told: true, kept: false, announced: false })] },
    { id: SESSION_D, unavailable: 'EACCES' },
  ];
  const lines = measuresLines(sessions);
  assert.deepEqual(lines.slice(1, 3), [`  ${at(10)}  automatic  told no  kept unknown  announced unknown`, `  ${at(20)}  automatic  told yes  kept no  announced no`]);
  assert.equal(lines[3], `${SESSION_D}  unavailable: EACCES`);
  assert.equal(lines.at(-1), '2 automatic compactions judged in 1 session: 2 miss a fact (told 1, kept 1, announced 1); 1 with a fact not known; 1 transcript could not be read');
});

test('measuresLines of sessions with no compaction is the total alone, which says that nothing was judged', () => {
  assert.deepEqual(measuresLines([{ id: SESSION_A, measures: [] }]), ['0 automatic compactions judged in 0 sessions: 0 miss a fact']);
  assert.deepEqual(measuresLines([]), ['0 automatic compactions judged in 0 sessions: 0 miss a fact']);
});

test('measuresTotal counts what the total line says, as data', () => {
  const sessions = [
    { id: SESSION_A, measures: [asked(6), judged(20, { told: true, kept: null, announced: false }), elsewhere(25)] },
    { id: SESSION_D, unavailable: 'EACCES' },
  ];
  assert.deepEqual(measuresTotal(sessions), { judged: 1, sessions: 1, missing: 1, facts: { told: 0, kept: 0, announced: 1 }, unknown: 1, asked: 1, elsewhere: 1, unreadable: 1 });
});
