import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStartOf, keptByGitLog, keptByRelief, keptEither, localDay, measuresLines, measuresTotal, reliefLines, reliefMeasures, reliefsTotal, reopenCandidates, reopenLines } from './measures.mjs';
import { reliefStamp } from './channel.mjs';
import { DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, percentOf, shareOf } from './sessions.mjs';

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
  assert.deepEqual(kept(`${minuteOnly(3)} the notice's minute, no seconds\n`), { known: false, undecided: true });
  assert.deepEqual(kept(`${minuteOnly(6)} the boundary's minute, no seconds\n`), { known: false, undecided: true });
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

// T9b's first advisory: a hand-written relief line in a bound's minute may be the state kept, so git's "not kept"
// beside it is not a miss. A reader that could not be read at all (no relief file) defers nothing.
test('keptEither knows nothing when a reader is undecided and none says kept, and an unreadable reader defers no miss', () => {
  const query = { document: '/p/odd/tasks/x.md', after: at(3), before: at(6) };
  const yes = () => ({ known: true, kept: true });
  const no = () => ({ known: true, kept: false });
  const undecided = () => ({ known: false, undecided: true });
  const unreadable = () => ({ known: false });
  assert.deepEqual(keptEither(no, undecided)(query), { known: false }, 'git not kept, the relief line in a bound minute');
  assert.deepEqual(keptEither(yes, undecided)(query), { known: true, kept: true }, 'a kept answer decides');
  assert.deepEqual(keptEither(no, unreadable)(query), { known: true, kept: false }, 'no relief file is still a miss');
  const minuteOnly = (minute) => reliefStamp(Date.parse(at(minute))).replace(/(\d{2}:\d{2}):\d{2} local/, '$1 local');
  const relief = keptByRelief(() => `${minuteOnly(3)} hand-written in the notice's minute\n`, RELIEF);
  assert.deepEqual(keptEither(no, relief)(query), { known: false }, 'through the real relief reader');
});

// --- measuresLines ---

const asked = (minute) => ({ at: at(minute), automatic: false, inThisFile: true, verdict: null });
const elsewhere = (minute) => ({ at: at(minute), automatic: true, inThisFile: false, verdict: null });
const judged = (minute, { told, kept }) => ({
  at: at(minute),
  automatic: true,
  inThisFile: true,
  verdict: { told, kept, missing: ['told', 'kept'].filter((name) => ({ told, kept })[name] === false) },
});

const SESSION_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const SESSION_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const SESSION_C = 'cccccccc-3333-4333-8333-333333333333';
const SESSION_D = 'dddddddd-4444-4444-8444-444444444444';

// The facts are two since he stopped compacting by hand (odd/tasks/no-manual-compact.md, S1): no reply announces a
// compaction to him, so no line names `announced`.
test('measuresLines prints a block per session with a compaction, each compaction oldest first with its two facts, then the total', () => {
  const sessions = [
    { id: SESSION_A, title: 'JH 5 board', measures: [asked(6), judged(20, { told: false, kept: null })] },
    { id: SESSION_B, title: 'nothing compacted', measures: [] },
    { id: SESSION_C, measures: [judged(40, { told: true, kept: true }), elsewhere(30)] },
  ];
  const lines = measuresLines(sessions);
  assert.deepEqual(lines, [
    'aaaaaaaa  JH 5 board',
    `  ${at(6)}  asked`,
    `  ${at(20)}  automatic  told no  kept unknown`,
    SESSION_C,
    `  ${at(30)}  automatic  not judged: the stretch before it is not in this transcript`,
    `  ${at(40)}  automatic  told yes  kept yes`,
    '2 automatic compactions judged in 2 sessions: 1 misses a fact (told 1); 1 with a fact not known; 1 asked, not judged; 1 automatic not judged here',
  ]);
  assert.doesNotMatch(lines.join('\n'), /announced/);
});

test('measuresLines names every fact missed with its count, and says a transcript that could not be read', () => {
  const sessions = [
    { id: SESSION_A, title: 'one', measures: [judged(10, { told: false, kept: null }), judged(20, { told: true, kept: false })] },
    { id: SESSION_D, unavailable: 'EACCES' },
  ];
  const lines = measuresLines(sessions);
  assert.deepEqual(lines.slice(1, 3), [`  ${at(10)}  automatic  told no  kept unknown`, `  ${at(20)}  automatic  told yes  kept no`]);
  assert.equal(lines[3], `${SESSION_D}  unavailable: EACCES`);
  assert.equal(lines.at(-1), '2 automatic compactions judged in 1 session: 2 miss a fact (told 1, kept 1); 1 with a fact not known; 1 transcript could not be read');
});

test('measuresLines of sessions with no compaction is the total alone, which says that nothing was judged', () => {
  assert.deepEqual(measuresLines([{ id: SESSION_A, measures: [] }]), ['0 automatic compactions judged in 0 sessions: 0 miss a fact']);
  assert.deepEqual(measuresLines([]), ['0 automatic compactions judged in 0 sessions: 0 miss a fact']);
});

test('measuresTotal counts what the total line says, as data', () => {
  const sessions = [
    { id: SESSION_A, measures: [asked(6), judged(20, { told: false, kept: null }), elsewhere(25)] },
    { id: SESSION_D, unavailable: 'EACCES' },
  ];
  assert.deepEqual(measuresTotal(sessions), { judged: 1, sessions: 1, missing: 1, facts: { told: 1, kept: 0 }, unknown: 1, asked: 1, elsewhere: 1, unreadable: 1 });
});

// --- reliefMeasures: the reliefs of the record, judged by the peak of the relieved session (session channel, T9) ---

const WINDOW = DEFAULT_CONTEXT_WINDOW;
const PAUSE = DEFAULT_CONTEXT_PAUSE_PERCENT;
const PAUSE_TOKENS = shareOf(WINDOW, PAUSE);
const FILLED = PAUSE_TOKENS + 1000;
const BELOW = PAUSE_TOKENS - 1000;
const SENDER_FILLED = 'eeeeeeee-5555-4555-8555-555555555555';
const SENDER_BELOW = 'ffffffff-6666-4666-8666-666666666666';
const SENDER_SILENT = '99999999-7777-4777-8777-777777777777';
const SENDER_NO_FILE = '88888888-8888-4888-8888-888888888888';
const pad = (number) => String(number).padStart(2, '0');
/** The instant of a local time on the 15th of October 2026, the day the tests read. */
const LOCAL = (hour, minute = 0, day = 15) => new Date(2026, 9, day, hour, minute).getTime();
const stamp = (ms) => new Date(ms).toISOString();
const usageReply = (ms, tokens) => ({ type: 'assistant', timestamp: stamp(ms), message: { role: 'assistant', model: 'model-x', stop_reason: 'end_turn', usage: { input_tokens: 0, cache_read_input_tokens: tokens, cache_creation_input_tokens: 0, output_tokens: 5 }, content: [{ type: 'text', text: 'ok' }] } });
const boundaryAt = (ms, preTokens) => ({ type: 'system', subtype: 'compact_boundary', timestamp: stamp(ms), compactMetadata: { trigger: 'auto', preTokens, postTokens: 300 } });
const readUsage = (ms, window) => ({ type: 'user', timestamp: stamp(ms), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_u1', content: JSON.stringify({ session: 'self', context: { contextWindow: window } }) }] } });
const promptAt = (ms) => ({ type: 'user', timestamp: stamp(ms), message: { role: 'user', content: 'hola' } });
const transcriptOf = (...entries) => entries.map((entry) => JSON.stringify(entry));
/** A relieved notice as the record keeps it: the sender is `id`, renamed `title` before the handover appended it. */
const relievedNotice = (ms, id, { title = 'JH ORQ viejo · relevado 04:25', context = null } = {}) => ({
  schema: 'js-harness.channel-notice/v1', at: stamp(ms), from: { host: 'claude-code', id, source: 'environment', title, permissionMode: 'bypassPermissions', context }, to: { role: 'orchestrator' }, kind: 'relieved', text: 'the context filled',
});
/** The transcripts by id: an id with no entry is a file that does not exist, and throws as the reader does. */
const transcriptsOf = (files, seen = []) => (id) => {
  seen.push(id);
  if (!(id in files)) throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
  return files[id];
};

test('reliefMeasures judges each relief by the peak of its relieved session: filled at the pause, another reason below it, not known without usage or a transcript', () => {
  const files = {
    [SENDER_FILLED]: transcriptOf(usageReply(LOCAL(9), BELOW), usageReply(LOCAL(10), FILLED), usageReply(LOCAL(10, 20), BELOW)),
    [SENDER_BELOW]: transcriptOf(usageReply(LOCAL(9), BELOW), usageReply(LOCAL(10), BELOW - 5000)),
    [SENDER_SILENT]: transcriptOf(promptAt(LOCAL(9))),
  };
  const reliefs = reliefMeasures([
    relievedNotice(LOCAL(10, 30), SENDER_FILLED),
    relievedNotice(LOCAL(10, 40), SENDER_BELOW),
    relievedNotice(LOCAL(10, 50), SENDER_SILENT),
    relievedNotice(LOCAL(11), SENDER_NO_FILE),
  ], { since: dayStartOf(LOCAL(10)), transcriptLines: transcriptsOf(files), pausePercent: PAUSE, defaultWindow: WINDOW });
  assert.deepEqual(reliefs.map(({ relieved, verdict, peak }) => [relieved, verdict, peak?.tokens ?? null]), [
    [SENDER_FILLED, 'filled', FILLED],
    [SENDER_BELOW, 'another reason', BELOW],
    [SENDER_SILENT, 'not known', null],
    [SENDER_NO_FILE, 'not known', null],
  ]);
});

test('reliefMeasures reads no transcript for a notice whose sender is not the relieved title, or whose sender has no id', () => {
  const seen = [];
  const files = { [SENDER_FILLED]: transcriptOf(usageReply(LOCAL(9), FILLED)) };
  const reliefs = reliefMeasures([
    relievedNotice(LOCAL(10), SENDER_FILLED, { title: 'JH 2 · board' }),
    relievedNotice(LOCAL(10, 5), null),
  ], { since: dayStartOf(LOCAL(10)), transcriptLines: transcriptsOf(files, seen), pausePercent: PAUSE, defaultWindow: WINDOW });
  assert.deepEqual(seen, [], 'no transcript is read for a sender that is not the relieved one');
  assert.deepEqual(reliefs.map(({ relieved, verdict }) => [relieved, verdict]), [[null, 'not known'], [null, 'not known']]);
});

test('reliefMeasures reads the peak after the last compaction before the notice, and carries that compaction\'s preTokens', () => {
  const files = { [SENDER_FILLED]: transcriptOf(usageReply(LOCAL(9), FILLED), boundaryAt(LOCAL(9, 30), 480000), usageReply(LOCAL(10), BELOW)) };
  const [one] = reliefMeasures([relievedNotice(LOCAL(10, 30), SENDER_FILLED, { context: { tokens: 1234, percent: 1 } })], { since: dayStartOf(LOCAL(10)), transcriptLines: transcriptsOf(files), pausePercent: PAUSE, defaultWindow: WINDOW });
  assert.deepEqual([one.verdict, one.peak.tokens, one.preTokens, one.fromContext], ['another reason', BELOW, 480000, { tokens: 1234, percent: 1 }], 'the host compacted it before, and it had room again');
});

test('reliefMeasures reads the window of the session\'s own last get_usage read before the notice, else the default window', () => {
  const window = 300000;
  const tokens = shareOf(window, PAUSE) + 1000;
  assert.ok(tokens < PAUSE_TOKENS, 'at the pause of a 300k window, not of the default one');
  const files = {
    [SENDER_FILLED]: transcriptOf(readUsage(LOCAL(9), window), usageReply(LOCAL(10), tokens), readUsage(LOCAL(10, 40), WINDOW)),
    [SENDER_BELOW]: transcriptOf(usageReply(LOCAL(10), tokens)),
  };
  const reliefs = reliefMeasures([relievedNotice(LOCAL(10, 30), SENDER_FILLED), relievedNotice(LOCAL(10, 31), SENDER_BELOW)], { since: dayStartOf(LOCAL(10)), transcriptLines: transcriptsOf(files), pausePercent: PAUSE, defaultWindow: WINDOW });
  assert.deepEqual(reliefs.map(({ window: read, verdict }) => [read, verdict]), [[window, 'filled'], [WINDOW, 'another reason']], 'a read after the notice is not the window of the relief');
});

test('reliefMeasures keeps the reliefs of the whole day the window touches: a relief of the morning is read by a window that starts at noon', () => {
  const files = { [SENDER_FILLED]: transcriptOf(usageReply(LOCAL(7), FILLED)) };
  const reliefs = reliefMeasures([relievedNotice(LOCAL(8), SENDER_FILLED), relievedNotice(LOCAL(23, 0, 14), SENDER_FILLED)], { since: dayStartOf(LOCAL(12)), transcriptLines: transcriptsOf(files), pausePercent: PAUSE, defaultWindow: WINDOW });
  assert.deepEqual(reliefs.map((one) => one.at), [stamp(LOCAL(8))], 'the day before is not in the window');
  assert.equal(localDay(LOCAL(8)), '2026-10-15');
  assert.equal(dayStartOf(LOCAL(12)), LOCAL(0));
});

test('reliefLines prints a line per relief in local time, with its relieved session, its peak against the window, its verdict and the pause', () => {
  const files = { [SENDER_FILLED]: transcriptOf(usageReply(LOCAL(7), FILLED)), [SENDER_SILENT]: transcriptOf(promptAt(LOCAL(7))) };
  const reliefs = reliefMeasures([relievedNotice(LOCAL(8, 5), SENDER_FILLED), relievedNotice(LOCAL(9), SENDER_SILENT), relievedNotice(LOCAL(9, 30), SENDER_NO_FILE, { title: 'JH 2 · board' })], { since: dayStartOf(LOCAL(12)), transcriptLines: transcriptsOf(files), pausePercent: PAUSE, defaultWindow: WINDOW });
  assert.deepEqual(reliefLines(reliefs, { since: dayStartOf(LOCAL(12)), now: LOCAL(12) }), [
    `2026-10-15 08:05  eeeeeeee  peak ${percentOf(FILLED, WINDOW)}% of 500k  filled  pause ${PAUSE}%`,
    `2026-10-15 09:00  ${SENDER_SILENT.slice(0, 8)}  peak not known  not known  pause ${PAUSE}%`,
    `2026-10-15 09:30  unknown  peak not known  not known  pause ${PAUSE}%`,
    `3 reliefs, 1 because the context filled; days with more than one: none`,
  ]);
});

test('reliefLines names the days with more than one relief that filled, and says when the record holds none for the days read', () => {
  const files = { [SENDER_FILLED]: transcriptOf(usageReply(LOCAL(7), FILLED)), [SENDER_BELOW]: transcriptOf(usageReply(LOCAL(7), BELOW)) };
  const reliefs = reliefMeasures([relievedNotice(LOCAL(8), SENDER_FILLED), relievedNotice(LOCAL(9), SENDER_FILLED), relievedNotice(LOCAL(10), SENDER_BELOW)], { since: dayStartOf(LOCAL(12)), transcriptLines: transcriptsOf(files), pausePercent: PAUSE, defaultWindow: WINDOW });
  assert.deepEqual(reliefsTotal(reliefs), { reliefs: 3, filled: 2, days: ['2026-10-15'] });
  assert.equal(reliefLines(reliefs, { since: dayStartOf(LOCAL(12)), now: LOCAL(12) }).at(-1), '3 reliefs, 2 because the context filled; days with more than one: 2026-10-15');
  assert.deepEqual(reliefLines([], { since: dayStartOf(LOCAL(12, 0, 14)), now: LOCAL(12) }), ['no relieved notice in the record for 2026-10-14..2026-10-15']);
  assert.deepEqual(reliefLines([], { since: dayStartOf(LOCAL(12)), now: LOCAL(12) }), ['no relieved notice in the record for 2026-10-15..2026-10-15'], 'never "no relief"');
});

// --- reopenCandidates: the Log lines of the feature documents that name a reopening (session channel, T9) ---

const ROOT = 'D:/proj';
const DOCUMENT = 'odd/tasks/orphan-gate.md';
const MERGE = '1134f84aa0c7c2f0b62d5a1c1d7e9f0a2b3c4d5e';
const MERGED_AT = '2026-10-14T09:00:00+02:00';
/** The document after the merge, line by line: `- **L9**` and `reopen` sit outside the Log, `reopen notes` has no Log id, and
 * `- **L7**` is the reopening. Every line is added by the merge, one hunk for the whole file. */
const DOCUMENT_TEXT = [
  '# Orphan gate', '', '## Specs', '', '- **S1** the gate.', '- **L9** reopened in the specs, not the log', '', '## Log',
  '- **L1** the original request', '- **L6** done', '- reopen notes without an id', "- **L7** reopened by the lead's order: T2 back to open", '- L8. the lead closed it again',
];
const MERGE_DIFF = [
  `commit ${MERGE} ${MERGED_AT} Merge pull request #240 from feat/gate`,
  `diff --git a/${DOCUMENT} b/${DOCUMENT}`,
  'new file mode 100644',
  '--- /dev/null',
  `+++ b/${DOCUMENT}`,
  `@@ -0,0 +1,${DOCUMENT_TEXT.length} @@`,
  ...DOCUMENT_TEXT.map((line) => `+${line}`),
  '',
].join('\n');

/** A fake `run` for `git log` (the diff) and `git show` (the document as the merge left it). */
function gitFor({ log = ok(MERGE_DIFF), show = ok(DOCUMENT_TEXT.join('\n')), head = ok('origin/main\n') } = {}) {
  const calls = [];
  const run = (command, args) => {
    calls.push({ command, args });
    if (args.includes('rev-parse')) return head;
    return args.includes('show') ? (typeof show === 'function' ? show(args) : show) : (typeof log === 'function' ? log(args) : log);
  };
  return { run, calls };
}

test('reopenCandidates names the Log lines that open with a Log id and say reopen, and no other line', () => {
  const git = gitFor();
  const found = reopenCandidates(git.run, ROOT, '2026-10-14T00:00:00Z');
  assert.deepEqual(found, { known: true, candidates: [{ at: MERGED_AT, document: DOCUMENT, id: 'L7', commit: MERGE.slice(0, 7) }] });
  assert.deepEqual(git.calls[0].args, ['-C', ROOT, 'rev-parse', '--abbrev-ref', 'origin/HEAD'], 'the default branch, whatever the main checkout has out');
  assert.deepEqual(git.calls[1].args, ['-C', ROOT, 'log', '-p', '-m', '--first-parent', '--format=commit %H %cI %s', '--since=2026-10-14T00:00:00Z', 'origin/main', '--', 'odd/tasks/*.md'], 'the pathspec goes through as one argument, no shell');
  assert.deepEqual(git.calls[2].args, ['-C', ROOT, 'show', `${MERGE}:${DOCUMENT}`]);
});

// Codex on f8ca1d6: a main checkout on a feature branch must not make its unmerged Log lines read as landed.
test('reopenCandidates reads the default branch, and is not known when git cannot name it', () => {
  const git = gitFor({ head: ok('origin/trunk\n') });
  reopenCandidates(git.run, ROOT, '2026-10-14T00:00:00Z');
  assert.ok(git.calls[1].args.includes('origin/trunk'), JSON.stringify(git.calls[1].args));
  const unnamed = reopenCandidates(gitFor({ head: { status: 128, stdout: '', stderr: 'fatal: ambiguous argument origin/HEAD' } }).run, ROOT, '2026-10-14T00:00:00Z');
  assert.equal(unnamed.known, false);
  assert.match(unnamed.why, /default branch/);
});

test('reopenCandidates is not known when git fails, a call throws, or the document cannot be read, and never says zero', () => {
  const failing = reopenCandidates(gitFor({ log: { status: 128, stdout: '', stderr: 'fatal: not a git repository' } }).run, ROOT, '2026-10-14T00:00:00Z');
  assert.equal(failing.known, false);
  assert.match(failing.why, /fatal: not a git repository/);
  const thrown = reopenCandidates(() => {
    throw new Error('spawn git ENOENT');
  }, ROOT, '2026-10-14T00:00:00Z');
  assert.deepEqual(thrown, { known: false, why: 'the default branch is not known: spawn git ENOENT' }, 'the first call names the branch');
  const unread = reopenCandidates(gitFor({ show: { status: 128, stdout: '', stderr: 'fatal: path not in tree' } }).run, ROOT, '2026-10-14T00:00:00Z');
  assert.equal(unread.known, false);
  assert.match(unread.why, /path not in tree/);
});

test('reopenCandidates reads no candidate in a diff that adds no reopening, and a line that is only removed is no candidate', () => {
  const quiet = `commit ${MERGE} ${MERGED_AT} Merge pull request #241\ndiff --git a/${DOCUMENT} b/${DOCUMENT}\n--- a/${DOCUMENT}\n+++ b/${DOCUMENT}\n@@ -9,1 +9,2 @@\n- **L6** done\n+- **L8** closed\n`;
  assert.deepEqual(reopenCandidates(gitFor({ log: ok(quiet) }).run, ROOT, '2026-10-14T00:00:00Z'), { known: true, candidates: [] });
});

test('reopenLines prints a line per candidate, then the closing line that says what it cannot see', () => {
  const [candidate] = reopenCandidates(gitFor().run, ROOT, '2026-10-14T00:00:00Z').candidates;
  const local = new Date(MERGED_AT);
  const when = `${localDay(local.getTime())} ${pad(local.getHours())}:${pad(local.getMinutes())}`;
  assert.deepEqual(reopenLines({ known: true, candidates: [candidate] }), [
    `${when}  ${DOCUMENT}  L7  1134f84`,
    '1 Log line names a reopening: candidates for the lead, cause not read. A reopening written in no Log, or closed again inside one pull request, is not seen.',
  ]);
  assert.deepEqual(reopenLines({ known: true, candidates: [] })[0], '0 Log lines name a reopening: candidates for the lead, cause not read. A reopening written in no Log, or closed again inside one pull request, is not seen.');
  assert.deepEqual(reopenLines({ known: false, why: 'fatal: not a git repository' }), ['reopen candidates: not known (fatal: not a git repository)']);
});
