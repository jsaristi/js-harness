import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { recordPath } from './channel.mjs';
import { ABSENCE_MS, AWAY_MARKER, NO_STRETCH_MARKER, OPEN_STRETCH_MARKER, RETURN_MARKER, departureLine, departureWatch, returnReportWarning, returnStretchWarning, stretchRecordsIn } from './return-report.mjs';
import { mainCheckout, projectSlug } from './sessions.mjs';
import { RECORD_SCHEMA as STRETCH_SCHEMA, stretchFile } from './stretch.mjs';
import { RENDERED_SCHEMA, renderedFile } from './template-record.mjs';

// Its times are shown in local time (rule:local-time): the zone is pinned so no machine's own decides a result.
process.env.TZ = 'America/Bogota';

// The return check (odd/tasks/lead-duty-checks.md, spec 2). Its records are handed in: the channel record, the
// rendered record of the templates and the lead's transcript, under a home of the test's own. The times are the
// lead's transcript 0f71b2c6 of 2026-10-31: his message before he left at 13:54, his return at 01:33:48Z, the page
// published at 01:47:29Z and linked at 01:47:49Z (lines 38106 to 38120).
const PROJECT = path.resolve('/work/project');
const HOME = path.resolve('/home/me');
const TRANSCRIPT = path.resolve('/claude/projects/p/lead.jsonl');
const noGit = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
const SLUG = projectSlug(mainCheckout(noGit, PROJECT));
const RECORD = recordPath(HOME, SLUG);
const RENDERED = renderedFile(HOME, SLUG);
const PAGE = path.resolve('/scratch/report-1031.html');
const URL = 'https://claude.ai/artifact/6F8gsniNEjw4gUzwDf4f6e';
const LEFT = '2026-10-30T18:54:00.000Z';
const BACK = '2026-10-31T01:33:48.205Z';

const LEAD = { host: 'claude-code', id: 'lead-1', title: 'JH ORQ · orquestador F8' };
const WORK = { host: 'claude-code', id: 'work-1', title: 'JH 78 · evals' };
const notice = (at, from) => JSON.stringify({ schema: 'js-harness.channel-notice/v1', at, from, to: { role: 'orchestrator' }, kind: 'note', text: 'x' });
const NOTICES = [notice('2026-10-30T21:00:00.000Z', LEAD), notice('2026-10-30T22:00:00.000Z', WORK)];

const line = (entry) => JSON.stringify(entry);
const his = (at, text = 'hola') => line({ type: 'user', timestamp: at, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const said = (at, text) => line({ type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'text', text }] } });
const published = (at, file = PAGE, url = URL, id = 'toolu_pub') => [
  line({ type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Artifact', input: { file_path: file, icon: 'chart' } }] } }),
  line({ type: 'user', timestamp: at, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: `Published ${file} at ${url} (Version 1, version id 1793411252-8817) Icon: "chart".` }] } }),
];
const rendered = (at, file = PAGE, template = 'status-report') => line({ schema: RENDERED_SCHEMA, template, subject: 'status', sha256: 'a', normal: 'b', bytes: 1, at, head: null, path: file });
const warned = (reason) => line({ type: 'attachment', timestamp: '2026-10-31T01:40:00.000Z', attachment: { type: 'hook_blocking_error', hookName: 'Stop', hookEvent: 'Stop', blockingError: { blockingError: reason } } });

const LINKED = `Aquí está la página del avance: ${URL}\n\nSigo solo: me despierta el aviso de JH 113.`;
const TOTALS = 'Mientras no estabas se fusionaron 27 PR; F8 va en 52 %.\n\nSigo solo: me despierta el aviso de JH 113.';
const RETURN = [his(LEFT, 'me voy'), said('2026-10-30T18:55:00.000Z', 'Sigo solo.'), his(BACK, 'ya volví')];
const WITH_PAGE = [...RETURN, ...published('2026-10-31T01:47:29.192Z')];
const UNREADABLE = Symbol('unreadable');
const PAGE_RENDERED = [rendered('2026-10-31T01:46:50.000Z')];

function check({ transcript = RETURN, renders = [], record = NOTICES, message = TOTALS, payload = {}, state = 'working' } = {}) {
  const files = {
    [RECORD]: `${record.join('\n')}\n`,
    [TRANSCRIPT]: `${transcript.join('\n')}\n`,
  };
  // `null` is no rendered record; UNREADABLE is one that is there and cannot be read.
  if (renders !== null) files[RENDERED] = renders === UNREADABLE ? undefined : `${renders.join('\n')}\n`;
  const io = {
    readFile: (file) => {
      if (Object.hasOwn(files, file) && files[file] === undefined) throw Object.assign(new Error(`EACCES: ${file}`), { code: 'EACCES' });
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    run: noGit,
    env: { JS_HARNESS_HOME: HOME },
    homedir: () => path.resolve('/elsewhere'),
  };
  return returnReportWarning({ cwd: PROJECT, session_id: 'lead-1', transcript_path: TRANSCRIPT, background_tasks: [], last_assistant_message: message, ...payload }, state, io);
}

// --- the four planted cases of the brief ---

test('a planted return without the page is turned back once, with what to run', () => {
  const reason = check();
  assert.ok(reason.includes(RETURN_MARKER), reason);
  assert.match(reason, /^js-harness reply: /);
  assert.match(reason, /6\.7 hours/, 'how long he was away');
  assert.match(reason, /20:33, the one before at \d{2}:\d{2}, local time UTC-05:00/, 'when he came back, in local time');
  assert.match(reason, /js-harness report --mark --html <file> --notes <file>/);
  assert.match(reason, /Artifact/);
  assert.match(reason, /rule:reports-spanish-visual/);
  assert.match(reason, /once for this return/);
});

test('a return answered with the page the report wrote since his message, published and linked, passes', () => {
  assert.equal(check({ transcript: WITH_PAGE, renders: PAGE_RENDERED, message: LINKED }), null);
});

test('a message after a short gap is not touched', () => {
  const soon = new Date(Date.parse(LEFT) + ABSENCE_MS).toISOString();
  assert.equal(check({ transcript: [his(LEFT), his(soon)] }), null, 'exactly the threshold is no absence');
  const later = new Date(Date.parse(LEFT) + ABSENCE_MS + 1).toISOString();
  assert.notEqual(check({ transcript: [his(LEFT), his(later)] }), null);
});

test('short messages after his return keep it a return: the lead\'s first reply came after three of them', () => {
  // The lead's 0f71b2c6: "ya llegue" at 01:33:48Z, then 01:34:51Z, 01:42:11Z and 01:42:44Z, and the first reply at 01:43:11Z.
  const transcript = [...RETURN, his('2026-10-31T01:34:51.980Z'), his('2026-10-31T01:42:11.327Z'), his('2026-10-31T01:42:44.417Z')];
  const reason = check({ transcript });
  assert.match(reason, /his message at 20:33,/);
  assert.match(reason, /\(return at 2026-10-31T01:33:48\.205Z\)/);
  assert.equal(check({ transcript: [...transcript, ...published('2026-10-31T01:47:29.192Z')], renders: PAGE_RENDERED, message: LINKED }), null);
});

test('a work session\'s reply is not touched, nor a session that sent no notice', () => {
  assert.equal(check({ payload: { session_id: 'work-1' } }), null);
  assert.equal(check({ payload: { session_id: 'nobody' } }), null);
});

// --- what links the page ---

test('a page published but not linked in any reply since his message is turned back', () => {
  assert.notEqual(check({ transcript: WITH_PAGE, renders: PAGE_RENDERED, message: TOTALS }), null);
});

test('a reply since his message that linked the page is enough for the replies after it', () => {
  const transcript = [...WITH_PAGE, said('2026-10-31T01:47:49.921Z', LINKED)];
  assert.equal(check({ transcript, renders: PAGE_RENDERED, message: TOTALS }), null);
  const before = [...RETURN.slice(0, 2), said('2026-10-30T18:56:00.000Z', LINKED), RETURN[2], ...published('2026-10-31T01:47:29.192Z')];
  assert.notEqual(check({ transcript: before, renders: PAGE_RENDERED, message: TOTALS }), null, 'a link written before he came back is not one since');
});

test('the link must be the page the report wrote since his message: another page, an older render or another URL is not', () => {
  assert.notEqual(check({ transcript: WITH_PAGE, renders: [rendered('2026-10-31T01:00:00.000Z')], message: LINKED }), null, 'rendered before he came back');
  assert.notEqual(check({ transcript: WITH_PAGE, renders: [rendered('2026-10-31T01:46:50.000Z', PAGE, 'feature-close')], message: LINKED }), null, 'not the status report');
  assert.notEqual(check({ transcript: WITH_PAGE, renders: [rendered('2026-10-31T01:46:50.000Z', path.resolve('/scratch/other.html'))], message: LINKED }), null, 'another file');
  assert.notEqual(check({ transcript: WITH_PAGE, renders: [], message: LINKED }), null, 'nothing rendered');
  assert.notEqual(check({ transcript: WITH_PAGE, renders: null, message: LINKED }), null, 'no rendered record at all');
  const board = 'https://claude.ai/artifact/LAMAVwx92GosturPiuKbTD';
  assert.notEqual(check({ transcript: WITH_PAGE, renders: PAGE_RENDERED, message: `El tablero: ${board}\n\nSigo solo: espero.` }), null, 'the board is not the page');
});

test('a page published before he came back is not the one since his message', () => {
  const transcript = [his(LEFT), ...published('2026-10-31T01:00:00.000Z'), his(BACK)];
  assert.notEqual(check({ transcript, renders: PAGE_RENDERED, message: LINKED }), null);
});

test('the publish call may name the page in another spelling of its path, and update an artifact by its url', () => {
  const spelled = PAGE.replaceAll('\\', '/');
  const transcript = [...RETURN, ...published('2026-10-31T01:47:29.192Z', spelled)];
  assert.equal(check({ transcript, renders: PAGE_RENDERED, message: LINKED }), null);
  // An update names the artifact in its call; a result that gives no link still leaves the call's own.
  const update = [...RETURN,
    line({ type: 'assistant', timestamp: '2026-10-31T01:47:29.192Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_up', name: 'Artifact', input: { file_path: PAGE, url: URL } }] } }),
    line({ type: 'user', timestamp: '2026-10-31T01:47:30.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_up', content: [{ type: 'text', text: 'Updated.' }] }] } })];
  assert.equal(check({ transcript: update, renders: PAGE_RENDERED, message: LINKED }), null);
  const failed = [...RETURN,
    line({ type: 'assistant', timestamp: '2026-10-31T01:47:29.192Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_up', name: 'Artifact', input: { file_path: PAGE, url: URL } }] } }),
    line({ type: 'user', timestamp: '2026-10-31T01:47:30.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_up', is_error: true, content: 'refused' }] } })];
  assert.notEqual(check({ transcript: failed, renders: PAGE_RENDERED, message: LINKED }), null, 'a call the host refused published nothing');
});

// Codex's review of 1f19c04..767b6b5, part 1: a page published through the call's `files`, and a publish older than
// the render it would carry.
const publishedWith = (input, at = '2026-10-31T01:47:29.192Z', id = 'toolu_files') => [
  line({ type: 'assistant', timestamp: at, cwd: path.dirname(PAGE), message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Artifact', input }] } }),
  line({ type: 'user', timestamp: at, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: `Published at ${URL} (Version 2).` }] } }),
];

test('a page published through the call\'s files, a map, a list or a relative path under its root, is the page', () => {
  const other = path.resolve('/scratch/index.html');
  for (const input of [
    { file_path: other, files: { 'report.html': PAGE } },
    { file_path: other, files: { 'report.html': { from: PAGE } } },
    { file_path: other, files: [{ path: PAGE }] },
    { file_path: other, root: path.dirname(PAGE), files: { 'r.html': path.basename(PAGE) } },
    { file_path: path.basename(PAGE) },
  ]) {
    assert.equal(check({ transcript: [...RETURN, ...publishedWith(input)], renders: PAGE_RENDERED, message: LINKED }), null, JSON.stringify(input));
  }
  assert.notEqual(check({ transcript: [...RETURN, ...publishedWith({ action: 'read', url: URL, file_path: PAGE })], renders: PAGE_RENDERED, message: LINKED }), null, 'a read publishes nothing');
});

test('a publish before the render it would carry is not the page: the file it sent held the report before', () => {
  // The path rendered before he came back, published at 20:40, and rendered again at 01:46:50Z: the 20:40 artifact
  // holds the old report.
  const transcript = [...RETURN, ...published('2026-10-31T01:40:00.000Z')];
  assert.notEqual(check({ transcript, renders: [rendered('2026-10-31T01:00:00.000Z'), ...PAGE_RENDERED], message: LINKED }), null);
  assert.equal(check({ transcript: [...transcript, ...published('2026-10-31T01:47:29.192Z', PAGE, URL, 'toolu_again')], renders: PAGE_RENDERED, message: LINKED }), null, 'published again after the render');
});

// --- once a return, and only on Claude Code ---

test('it warns once a return: a warning that names this return lets the next stop through; a later return is warned again', () => {
  const first = check();
  assert.equal(check({ transcript: [...RETURN, warned(first)] }), null);
  const again = [...RETURN, warned(first), said('2026-10-31T01:50:00.000Z', TOTALS), his('2026-10-31T09:00:00.000Z', 'volví otra vez')];
  assert.notEqual(check({ transcript: again }), null);
});

test('his first message of a session is no return, and a tapped answer after a long gap is one', () => {
  assert.equal(check({ transcript: [his(BACK)] }), null);
  const ask = line({ type: 'assistant', timestamp: '2026-10-30T18:56:00.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_q', name: 'AskUserQuestion', input: { questions: [{ question: 'Pregunta 133: ¿abro?', options: [{ label: 'Sí' }, { label: 'No' }] }] } }] } });
  const tapped = line({ type: 'user', timestamp: BACK, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_q', content: 'Sí' }] }, toolUseResult: { answers: { 'Pregunta 133: ¿abro?': 'Sí' } } });
  assert.notEqual(check({ transcript: [his(LEFT), ask, tapped] }), null);
});

test('Codex, which sends no background tasks and cannot publish a page, is not told', () => {
  assert.equal(check({ payload: { background_tasks: undefined } }), null);
});

test('a record it cannot read throws, so the hook says the check did not run', () => {
  assert.throws(() => check({ renders: UNREADABLE }), /rendered record/);
});

// --- the stretch of his absence (odd/tasks/departure-stretch.md, spec 8) ---
// His two absences of 2026-10-31 had no stretch: "voy a dejarte entre 1 a 2 horas solo" at 03:23:57Z, back at
// 06:20:47Z, and the lead had opened none (the stretch record's last close was at 2026-10-30T13:13:20Z).
const STRETCHES = stretchFile(HOME, SLUG);
const opened = (at, id = at) => line({ schema: STRETCH_SCHEMA, event: 'open', id, at, plan: { hours: 4 } });
const closed = (at, id) => line({ schema: STRETCH_SCHEMA, event: 'close', id, at });

function stretchCheck({ transcript = RETURN, stretches = null, payload = {} } = {}) {
  const files = { [RECORD]: `${NOTICES.join('\n')}\n`, [TRANSCRIPT]: `${transcript.join('\n')}\n` };
  // `null` is no stretch record; UNREADABLE is one that is there and cannot be read.
  if (stretches !== null) files[STRETCHES] = stretches === UNREADABLE ? undefined : `${stretches.join('\n')}\n`;
  const io = {
    readFile: (file) => {
      if (Object.hasOwn(files, file) && files[file] === undefined) throw Object.assign(new Error(`EACCES: ${file}`), { code: 'EACCES' });
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    run: noGit,
    env: { JS_HARNESS_HOME: HOME },
    homedir: () => path.resolve('/elsewhere'),
  };
  return returnStretchWarning({ cwd: PROJECT, session_id: 'lead-1', transcript_path: TRANSCRIPT, background_tasks: [], last_assistant_message: TOTALS, ...payload }, 'working', io);
}

test('a return after an absence no stretch covered is turned back once, naming the failure to record', () => {
  for (const stretches of [null, [opened('2026-10-30T10:38:59.222Z', 's0'), closed('2026-10-30T13:13:20.627Z', 's0')]]) {
    const reason = stretchCheck({ stretches });
    assert.ok(reason.includes(NO_STRETCH_MARKER), reason);
    assert.match(reason, /^js-harness reply: /);
    assert.match(reason, /rule:away-autonomy/);
    assert.match(reason, /stretch-not-opened/, 'the failure to record');
    assert.match(reason, /docs\/FAILURES\.md/);
    assert.match(reason, /once for this return/);
  }
});

test('a return with the stretch of his absence still open is turned back once, naming stretch close', () => {
  const reason = stretchCheck({ stretches: [opened('2026-10-30T18:55:00.000Z', 's1')] });
  assert.ok(reason.includes(OPEN_STRETCH_MARKER), reason);
  assert.ok(reason.includes('js-harness stretch close --html <file>'), reason);
  assert.match(reason, /\bs1\b/, 'the stretch named');
});

test('a return whose stretch was opened before he left and closed since he came back passes', () => {
  assert.equal(stretchCheck({ stretches: [opened('2026-10-30T18:55:00.000Z', 's1'), closed('2026-10-31T01:40:00.000Z', 's1')] }), null);
});

test('a stretch opened while he was away covers the absence; one opened after he came back does not', () => {
  // Opened late, it cannot show the departure's forecast, but the return has its measure.
  assert.equal(stretchCheck({ stretches: [opened('2026-10-30T22:00:00.000Z', 's2'), closed('2026-10-31T01:40:00.000Z', 's2')] }), null);
  const after = stretchCheck({ stretches: [opened('2026-10-31T01:50:00.000Z', 's3')] });
  assert.ok(after.includes(NO_STRETCH_MARKER), after);
});

test('it warns of the stretch once a return, and a later return is warned again', () => {
  const first = stretchCheck();
  assert.equal(stretchCheck({ transcript: [...RETURN, warned(first)] }), null);
  const again = [...RETURN, warned(first), said('2026-10-31T01:50:00.000Z', TOTALS), his('2026-10-31T09:00:00.000Z', 'volví otra vez')];
  assert.notEqual(stretchCheck({ transcript: again }), null);
  assert.notEqual(stretchCheck({ transcript: [...RETURN, warned(check())] }), null, 'the page\'s warning for the same return is not this one');
});

test('no return, a work session and Codex are not told of the stretch', () => {
  const soon = new Date(Date.parse(LEFT) + ABSENCE_MS).toISOString();
  assert.equal(stretchCheck({ transcript: [his(LEFT), his(soon)] }), null);
  assert.equal(stretchCheck({ payload: { session_id: 'work-1' } }), null);
  assert.equal(stretchCheck({ payload: { background_tasks: undefined } }), null);
});

test('a stretch record it cannot read throws, so the hook says the check did not run', () => {
  assert.throws(() => stretchCheck({ stretches: UNREADABLE }), /stretch record/);
});

// --- the start of his absence (odd/tasks/departure-control.md, specs 1 and 3) ---
// The lead's heartbeat reads the transcript piece by piece and asks, each tick, whether he has been away longer than
// `ABSENCE_MS` with no stretch covering the time since: the lead is told then, not at his return. On 2026-11-10 he was
// away from 18:08 to 21:17 local with question 255 on his screen (the lead's transcript ea85ec35, lines 4515 to 4518).
const STARTS = Date.parse(LEFT) + ABSENCE_MS + 60_000;
const ASKED = '2026-10-30T18:56:00.000Z';
const asked = (at = ASKED, id = 'toolu_q') => line({ type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions: [{ question: 'Pregunta 255: ¿uno el PR 812?', options: [{ label: 'Sí' }, { label: 'No' }] }] } }] } });
const tapped = (at, id = 'toolu_q') => line({ type: 'user', timestamp: at, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Sí' }] }, toolUseResult: { answers: { 'Pregunta 255: ¿uno el PR 812?': 'Sí' } } });
const dismissed = (at, id = 'toolu_q') => line({ type: 'user', timestamp: at, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: true, content: 'The user doesn\'t want to proceed with this tool use.' }] } });
const records = (stretches) => stretchRecordsIn(stretches === null ? '' : `${stretches.join('\n')}\n`);

/** What a tick at `now` sees of `pieces`, each the transcript lines one tick read. */
function departure({ pieces = [[his(LEFT, 'me voy')]], stretches = null, now = STARTS } = {}) {
  const watch = departureWatch();
  for (const piece of pieces) watch.add(`${piece.join('\n')}\n`);
  return watch.read(records(stretches), now);
}

test('at the start of an absence no stretch covers, the lead is told: when he last wrote and the command that opens a stretch', () => {
  const found = departure();
  assert.deepEqual(found, { before: LEFT, away: ABSENCE_MS + 60_000, heldSince: null });
  const told = departureLine(found);
  assert.ok(told.startsWith(`${AWAY_MARKER} `), told);
  assert.match(told, /13:54/, 'the hour he last wrote, local');
  assert.match(told, /local time \(UTC-05:00\)/, 'the zone, said once');
  assert.match(told, /2\.0 hours/);
  assert.ok(told.includes('js-harness stretch open --plan <file> --html <file>'), told);
  assert.match(told, /rule:away-autonomy/);
  assert.match(told, /once for this absence/);
  assert.doesNotMatch(told, /question tool/);
});

test('nothing is told before the absence starts, nor with no message of his to count from', () => {
  assert.equal(departure({ now: Date.parse(LEFT) + ABSENCE_MS }), null, 'the gap must be longer than the absence, as at the return');
  assert.equal(departure({ pieces: [[said(LEFT, 'Sigo solo.')]] }), null);
  assert.equal(departure({ pieces: [] }), null);
});

test('a stretch open at any time since his last message covers the absence; one closed before it does not', () => {
  assert.equal(departure({ stretches: [opened('2026-10-30T18:00:00.000Z', 's1')] }), null, 'opened before he left, still open');
  assert.equal(departure({ stretches: [opened('2026-10-30T19:30:00.000Z', 's2')] }), null, 'opened after he left');
  assert.equal(departure({ stretches: [opened('2026-10-30T18:00:00.000Z', 's3'), closed('2026-10-30T19:00:00.000Z', 's3')] }), null, 'closed after he left');
  assert.notEqual(departure({ stretches: [opened('2026-10-30T10:38:59.222Z', 's0'), closed('2026-10-30T13:13:20.627Z', 's0')] }), null);
  assert.notEqual(departure({ stretches: [opened(new Date(STARTS + 60_000).toISOString(), 's4')] }), null, 'one opened after the tick is not there yet');
});

test('the tick and the return use one cover test: what the tick would tell just before his return, the return turns back', () => {
  const variants = [
    null,
    [opened('2026-10-30T10:38:59.222Z', 's0'), closed('2026-10-30T13:13:20.627Z', 's0')],
    [opened('2026-10-30T18:00:00.000Z', 's1'), closed('2026-10-30T18:30:00.000Z', 's1')],
    [opened('2026-10-30T18:00:00.000Z', 's2'), closed('2026-10-30T19:00:00.000Z', 's2')],
    [opened('2026-10-30T22:00:00.000Z', 's3'), closed('2026-10-31T01:40:00.000Z', 's3')],
    [opened('2026-10-31T01:50:00.000Z', 's4')],
  ];
  for (const stretches of variants) {
    const atReturn = stretchCheck({ stretches });
    const turnedBack = atReturn !== null && atReturn.includes(NO_STRETCH_MARKER);
    // The instant before his return: the tick has not read his message yet.
    const told = departure({ stretches, now: Date.parse(BACK) - 1 }) !== null;
    assert.equal(told, turnedBack, JSON.stringify(stretches));
  }
});

test('a tapped answer is his last message, and a message of his after the absence started ends it', () => {
  const answered = '2026-10-30T19:10:00.000Z';
  const found = departure({ pieces: [[his(LEFT), asked(), tapped(answered)]], now: Date.parse(answered) + ABSENCE_MS + 1 });
  assert.equal(found.before, answered);
  assert.equal(found.heldSince, null);
  assert.equal(departure({ pieces: [[his(LEFT)], [his(new Date(STARTS).toISOString(), 'ya volví')]], now: STARTS + 60_000 }), null);
});

test('a question on his screen holds the session: the line says since when, and that it could open no stretch', () => {
  const found = departure({ pieces: [[his(LEFT), asked()]] });
  assert.deepEqual(found, { before: LEFT, away: ABSENCE_MS + 60_000, heldSince: ASKED });
  const told = departureLine(found);
  assert.match(told, /question tool has held this session since 13:56/);
  assert.match(told, /`question-tool-holds-asker` in docs\/FAILURES\.md/, 'its own failure, recorded apart');
  assert.doesNotMatch(told, /stretch-not-opened/, 'a held session skipped no duty');
  assert.doesNotMatch(told, /stretch open --plan/, 'a held session is told nothing it cannot do');
  // Answered, or closed without an answer, the question holds nothing.
  assert.equal(departure({ pieces: [[his(LEFT), asked(), dismissed('2026-10-30T18:57:00.000Z')]] }).heldSince, null);
  assert.equal(departure({ pieces: [[his(LEFT), asked(), dismissed('2026-10-30T18:57:00.000Z'), asked('2026-10-30T18:58:00.000Z', 'toolu_q2')]] }).heldSince, '2026-10-30T18:58:00.000Z');
  // A side chain's question is not the session's.
  const side = line({ ...JSON.parse(asked()), isSidechain: true });
  assert.equal(departure({ pieces: [[his(LEFT), side]] }).heldSince, null);
});

test('a return that answers a question asked before the absence started names question-tool-holds-asker, not the missed stretch', () => {
  // The question tool held the session from the call to his answer: no turn of its own could open a stretch
  // (9 of the 23 absences no stretch covered from 2026-10-31 to 2026-11-10, odd/tasks/departure-control.md, L3).
  const held = stretchCheck({ transcript: [his(LEFT), asked(), tapped(BACK)] });
  assert.ok(held.includes(NO_STRETCH_MARKER), held);
  assert.match(held, /The question tool held this session from 13:56 until his answer/);
  assert.match(held, /`question-tool-holds-asker` in docs\/FAILURES\.md/);
  assert.doesNotMatch(held, /stretch-not-opened/);
  assert.match(held, /once for this return/);
  assert.equal(stretchCheck({ transcript: [his(LEFT), asked(), tapped(BACK), warned(held)] }), null, 'said once, as the other form is');
  // A question asked once the absence had started held nothing while it started: the session was free to open one.
  const late = stretchCheck({ transcript: [his(LEFT), asked(new Date(Date.parse(LEFT) + ABSENCE_MS + 1).toISOString()), tapped(BACK)] });
  assert.match(late, /stretch-not-opened/);
  assert.doesNotMatch(late, /question-tool-holds-asker/);
  // So is a return he typed, and a question a stretch covered is no warning at all.
  assert.match(stretchCheck({ transcript: [his(LEFT), asked(), dismissed('2026-10-30T18:57:00.000Z'), his(BACK)] }), /stretch-not-opened/);
  assert.equal(stretchCheck({ transcript: [his(LEFT), asked(), tapped(BACK)], stretches: [opened('2026-10-30T18:00:00.000Z', 's1'), closed('2026-10-31T01:40:00.000Z', 's1')] }), null);
});

test('a transcript read piece by piece gives what the whole gives, a question and its result apart included', () => {
  const lines = [his('2026-10-30T15:00:00.000Z'), asked('2026-10-30T15:01:00.000Z', 'toolu_a'), dismissed('2026-10-30T15:02:00.000Z', 'toolu_a'), his(LEFT), asked(), tapped('2026-10-30T19:10:00.000Z'), asked('2026-10-30T19:11:00.000Z', 'toolu_z')];
  const now = Date.parse('2026-10-30T19:10:00.000Z') + ABSENCE_MS + 1;
  const whole = departure({ pieces: [lines], now });
  assert.deepEqual(whole, { before: '2026-10-30T19:10:00.000Z', away: ABSENCE_MS + 1, heldSince: '2026-10-30T19:11:00.000Z' });
  for (let cut = 1; cut < lines.length; cut += 1) assert.deepEqual(departure({ pieces: [lines.slice(0, cut), lines.slice(cut)], now }), whole, `cut at ${cut}`);
  assert.deepEqual(departure({ pieces: lines.map((one) => [one]), now }), whole, 'a line a tick');
});
