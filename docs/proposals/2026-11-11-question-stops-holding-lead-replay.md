# The replay behind "How a question stops holding the lead": its scripts, 2026-11-11

The four read-only scripts that give every figure of `docs/proposals/2026-11-11-question-stops-holding-lead.md`, kept
here as text so the figures can be run again: the pull request that carries them is documents only. They read the
lead's transcripts `0f71b2c6` and `ea85ec35` under `~/.claude/projects/D--js-harness/`, the stretch record and the
channel record under `~/.js-harness/`, and write one file, `replay.json`, beside themselves. They import this
repository's own readers from the checkout given as their argument, so they are run against the commit that holds
this document.

To run them: save each block under its name in one folder outside the repository, then, from that folder and in
this order,

    node replay.mjs <checkout> --json
    node last-word.mjs <checkout>
    node words.mjs <checkout>
    node queued.mjs

What each gives:

- `replay.mjs`: the absences (31, 8 covered, 23 not, 8 held), every question call (114, 6 refused by the gate, 108
  shown), how long each waited, the hours held, `rule:person-present` kept or not, the second of a row, a bound on
  the wait, the option counts, and a presence rule as a gate at 1, 2, 5 and 15 minutes. Its line "task ends
  delivered within 15s" is a first, crude measure the proposal does not use; `queued.mjs` replaces it.
- `last-word.mjs`: his last entry before each hold over two hours, and the questions asked under five minutes after
  a typed message of his that is a request and nothing else, its `ASKS` pattern (2, which waited 19 minutes and 1).
  A third message of his in the window opens with a request form and goes on ("hazme las preguntas en serio por que
  ...", its question waited 8 minutes): the pattern leaves it out on purpose. It tests the request's form and age
  only, not the rest of the check the proposal describes.
- `words.mjs`: his typed words on questions in the three lead transcripts (the search of the feature document's L4),
  and the notices recorded for the lead while a question waited over 15 minutes (33, 9 of kind `ready`, naming 8
  pull requests).
- `queued.mjs`: what the host queued for the lead while a question stayed open over 15 minutes (12 ends of tasks, 1
  message of a session), and what was queued within two seconds before a question returned (one message he typed).

Two labels are weaker than they read, as the third review found. `queued.mjs` calls "typed by him" any queued entry
that does not start with "<"; the one case that matters was read by hand and is his (`0f71b2c6`, line 49241).
`replay.mjs` takes his last entry from both lead transcripts merged, where `rule:person-present` is about the session
that asks; how many of the 108 that changes was not counted.

The window is fixed in `replay.mjs` (`FROM`, `TO`), and the local time is written with the offset of that window,
UTC-05:00. A transcript the host has since removed or rewritten gives other figures; the files were 128 MB and 21 MB
when these ran.

## `replay.mjs`

```js
// Read-only replay for odd/tasks/question-holds-lead.md (JH 183): every question call of the lead's own thread in
// its two transcripts, when it was asked, how long it waited, and what a held absence looks like.
// Usage: node replay.mjs <worktree> [--json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const worktree = process.argv[2];
const lib = (file) => import(pathToFileURL(path.join(worktree, 'bin', 'lib', file)).href);
const { parseTranscript, questionCallsOf, quoteEntry, PERSON_PRESENT_MS } = await lib('sessions.mjs');
const { personLinesIn, linesHolding } = await lib('person-times.mjs');
const { ABSENCE_MS, stretchRecordsIn } = await lib('return-report.mjs');

const home = os.homedir();
const dir = path.join(home, '.claude', 'projects', 'D--js-harness');
const FILES = ['0f71b2c6-cbce-43ca-a031-276a4b2c381f', 'ea85ec35-82e1-4aa9-abe3-98bd153a50b0'];
const FROM = Date.parse('2026-10-31T12:00:00Z'); // 07:00 local, the depth pass's window of JH 176
const TO = Date.parse('2026-11-11T05:00:00Z'); // the end of local 2026-11-10

const local = (ms) => new Date(ms - 5 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');
const mins = (ms) => Math.round(ms / 60000);

const his = []; // { at, answered } every entry of his, both files
const calls = []; // { id, file, at, result, outcome, options, count }
const tasks = []; // times of task notifications delivered
for (const file of FILES) {
  const text = fs.readFileSync(path.join(dir, `${file}.jsonl`), 'utf8');
  const entries = parseTranscript(personLinesIn(text).join('\n')).entries;
  const known = questionCallsOf(entries);
  for (const entry of entries) {
    const quote = quoteEntry(entry, known);
    if (quote.person && typeof quote.at === 'string') his.push({ at: Date.parse(quote.at), answered: quote.answered !== undefined, file });
  }
  const own = [...known].filter(([, call]) => !call.sidechain);
  const ids = own.map(([id]) => id);
  const results = new Map();
  for (const line of linesHolding(text, ids)) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry?.type !== 'user' || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      if (block?.type !== 'tool_result' || !ids.includes(block.tool_use_id) || results.has(block.tool_use_id)) continue;
      const quote = quoteEntry(entry, known);
      const refused = block.is_error === true && JSON.stringify(block.content ?? '').includes('PreToolUse:AskUserQuestion hook error');
      results.set(block.tool_use_id, { at: Date.parse(entry.timestamp), outcome: quote.person ? 'answered' : refused ? 'refused by the question gate, never shown' : quote.what });
    }
  }
  for (const [id, call] of own) {
    const result = results.get(id) ?? null;
    const questions = Array.isArray(call.questions) ? call.questions : [];
    calls.push({ id, file: file.slice(0, 8), at: Date.parse(call.at), result: result?.at ?? null, outcome: result?.outcome ?? 'no result in the file',
      count: questions.length, options: questions.map((question) => (Array.isArray(question?.options) ? question.options.length : 0)) });
  }
  for (const line of linesHolding(text, ['"task-notification"'])) {
    const at = /"timestamp":"([^"]+)"/.exec(line)?.[1];
    if (at) tasks.push(Date.parse(at));
  }
}
his.sort((a, b) => a.at - b.at);
calls.sort((a, b) => a.at - b.at);
tasks.sort((a, b) => a - b);

// A call the host wrote again in the second file is the one already read: keep each id once.
const seen = new Set();
const asked = calls.filter((call) => !seen.has(call.id) && seen.add(call.id) && call.at >= FROM && call.at < TO);

const stretches = stretchRecordsIn(fs.readFileSync(path.join(home, '.js-harness', 'throughput', 'D--js-harness', 'stretches.jsonl'), 'utf8'));
const covers = (from, to) => stretches.some((one) => one.openedAt <= to && (one.closedAt === null || one.closedAt >= from));

// ---- the absences (JH 176's measure): a gap of his over ABSENCE_MS, covered or not, held or not ------------------
const times = [...new Set(his.map((one) => one.at))];
const absences = [];
for (let index = 1; index < times.length; index += 1) {
  const [before, back] = [times[index - 1], times[index]];
  if (before < FROM || before >= TO || back - before <= ABSENCE_MS) continue;
  const starts = before + ABSENCE_MS;
  const held = asked.find((call) => call.at >= before && call.at <= starts && (call.result === null || call.result > starts)) ?? null;
  absences.push({ before, back, covered: covers(before, back), held });
}
const uncovered = absences.filter((one) => !one.covered);
const heldOnes = uncovered.filter((one) => one.held !== null);

// ---- every question: how long after his last word it was asked, and how long it waited ---------------------------
const rows = asked.map((call) => {
  const last = [...his].reverse().find((one) => one.at <= call.at) ?? null;
  const wait = call.result === null ? null : call.result - call.at;
  // What reached the session in the 15 seconds after the tool returned: task ends the host had queued behind it.
  const queued = call.result === null ? 0 : tasks.filter((at) => at >= call.result && at <= call.result + 15_000).length;
  return { ...call, sinceHis: last === null ? null : call.at - last.at, afterAnswer: last?.answered ?? false, wait, queued };
});
const withWait = rows.filter((row) => row.wait !== null && !row.outcome.startsWith('refused'));
console.log('calls the question gate refused before they were shown: ' + rows.filter((row) => row.outcome.startsWith('refused')).length + '; shown: ' + withWait.length);
const bucket = (limit) => withWait.filter((row) => row.wait <= limit * 60000).length;
const kept = withWait.filter((row) => row.sinceHis !== null && row.sinceHis < PERSON_PRESENT_MS);
const long = (list, limit) => list.filter((row) => row.wait > limit * 60000);
const sum = (list, f) => list.reduce((total, row) => total + f(row), 0);

console.log(`window: local ${local(FROM)} to ${local(TO)} (UTC-05:00); his entries ${times.filter((at) => at >= FROM && at < TO).length}`);
console.log(`absences over 2h: ${absences.length}; a stretch covered ${absences.length - uncovered.length}; not covered ${uncovered.length}; of those held by a question ${heldOnes.length}`);
for (const one of heldOnes) console.log(`  held: he last wrote ${local(one.before)}, back ${local(one.back)}; question asked ${local(one.held.at)} (${Math.round((one.held.at - one.before) / 1000)}s after his last word), returned ${one.held.result === null ? 'never' : local(one.held.result)} as "${one.held.outcome}"`);
console.log(`last five uncovered: ${uncovered.slice(-5).map((one) => `${local(one.before)}${one.held ? ' HELD' : ''}`).join('; ')}`);
console.log('');
console.log(`question calls of the lead's own thread in the window: ${asked.length}; with a result ${withWait.length}; answered ${withWait.filter((row) => row.outcome === 'answered').length}; other results: ${JSON.stringify(Object.fromEntries([...new Set(withWait.filter((row) => row.outcome !== 'answered').map((row) => row.outcome))].map((what) => [what, withWait.filter((row) => row.outcome === what).length])))}`);
console.log(`calls with more than one question: ${asked.filter((row) => row.count > 1).length}; option counts: ${JSON.stringify(Object.fromEntries([2, 3, 4].map((n) => [n, asked.filter((row) => row.options.includes(n)).length])))}`);
console.log(`waited at most: 1m ${bucket(1)}, 2m ${bucket(2)}, 5m ${bucket(5)}, 10m ${bucket(10)}, 15m ${bucket(15)}, 30m ${bucket(30)}, 60m ${bucket(60)}, 120m ${bucket(120)}, all ${withWait.length}`);
console.log(`total time the tool held the lead: ${(sum(withWait, (row) => row.wait) / 3600000).toFixed(1)} h; in waits over 15m: ${(sum(long(withWait, 15), (row) => row.wait) / 3600000).toFixed(1)} h (${long(withWait, 15).length} calls); over 120m: ${(sum(long(withWait, 120), (row) => row.wait) / 3600000).toFixed(1)} h (${long(withWait, 120).length} calls)`);
console.log(`asked under rule:person-present (his last word under ${mins(PERSON_PRESENT_MS)}m before): ${kept.length} of ${withWait.length}; of those, waited over 15m: ${long(kept, 15).length}, over 60m: ${long(kept, 60).length}, over 120m: ${long(kept, 120).length}`);
console.log(`asked right after an answer of his to a question (his last word was a tapped or typed answer, under 2m before): ${withWait.filter((row) => row.afterAnswer && row.sinceHis < 120000).length}; of those waited over 15m: ${long(withWait.filter((row) => row.afterAnswer && row.sinceHis < 120000), 15).length}, over 120m: ${long(withWait.filter((row) => row.afterAnswer && row.sinceHis < 120000), 120).length}`);
console.log(`asked past the rule (his last word ${mins(PERSON_PRESENT_MS)}m or more before, or none): ${withWait.length - kept.length}; of those waited over 15m: ${long(withWait.filter((row) => !kept.includes(row)), 15).length}`);
for (const bound of [5, 10, 15, 30]) {
  const late = long(withWait, bound);
  console.log(`a bound of ${bound}m: ${late.length} of ${withWait.length} calls would have returned unanswered (${late.filter((row) => row.outcome === 'answered').length} of them he did answer later); hold left ${((sum(withWait, (row) => Math.min(row.wait, bound * 60000))) / 3600000).toFixed(1)} h of ${(sum(withWait, (row) => row.wait) / 3600000).toFixed(1)} h`);
}
console.log(`task ends delivered within 15s of a question's return, over the calls that waited more than 15m: ${sum(long(withWait, 15), (row) => row.queued)} (calls with at least one: ${long(withWait, 15).filter((row) => row.queued > 0).length} of ${long(withWait, 15).length})`);
console.log('');
console.log('calls that waited over 60m (asked local, seconds after his last word, after an answer, waited minutes, outcome, task ends queued):');
for (const row of long(withWait, 60)) console.log(`  ${row.file} ${local(row.at)}  +${row.sinceHis === null ? '?' : Math.round(row.sinceHis / 1000)}s  ${row.afterAnswer ? 'after-answer' : 'after-typed'}  ${mins(row.wait)}m  ${row.outcome}  queued ${row.queued}`);
const open = rows.filter((row) => row.wait === null);
if (open.length > 0) console.log(`calls with no result in either file: ${open.map((row) => local(row.at)).join(', ')}`);
if (process.argv.includes('--json')) fs.writeFileSync(path.join(path.dirname(process.argv[1]), 'replay.json'), JSON.stringify({ absences, rows }, null, 1));

// A presence rule made into a gate, at each value: what it refuses and what it still lets through.
for (const limit of [1, 2, 5, 15]) {
  const pass = withWait.filter((row) => row.sinceHis !== null && row.sinceHis < limit * 60000);
  console.log(`a presence gate at ${limit}m: refuses ${withWait.length - pass.length} of ${withWait.length}; lets through ${pass.length}, of them waited over 15m ${long(pass, 15).length}, over 120m ${long(pass, 120).length}`);
}
console.log(`answered within 15m: ${withWait.filter((row) => row.outcome === 'answered' && row.wait <= 15 * 60000).length}`);
```

## `last-word.mjs`

```js
// Read-only: his last entry before each question that waited over two hours (typed or an answer, and its first
// words), and how many shown questions followed, under five minutes, a typed entry of his that is a request.
// Usage: node last-word.mjs <worktree>   (after replay.mjs --json)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const worktree = process.argv[2];
const lib = (file) => import(pathToFileURL(path.join(worktree, 'bin', 'lib', file)).href);
const { parseTranscript, questionCallsOf, quoteEntry } = await lib('sessions.mjs');
const { personLinesIn } = await lib('person-times.mjs');
const dir = path.join(os.homedir(), '.claude', 'projects', 'D--js-harness');
const replay = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[1]), 'replay.json'), 'utf8'));
const his = [];
for (const file of ['0f71b2c6-cbce-43ca-a031-276a4b2c381f', 'ea85ec35-82e1-4aa9-abe3-98bd153a50b0']) {
  const entries = parseTranscript(personLinesIn(fs.readFileSync(path.join(dir, `${file}.jsonl`), 'utf8')).join('\n')).entries;
  const calls = questionCallsOf(entries);
  for (const entry of entries) {
    const quote = quoteEntry(entry, calls);
    if (quote.person && typeof quote.at === 'string') his.push({ at: Date.parse(quote.at), answered: quote.answered !== undefined, text: String(quote.text ?? '').replace(/\s+/g, ' ') });
  }
}
his.sort((a, b) => a.at - b.at);
const local = (ms) => new Date(ms - 5 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');
const shown = replay.rows.filter((row) => row.wait !== null && !row.outcome.startsWith('refused'));
// The request the proposal gives the gate: his whole message is a request form, with nothing else but an opening
// "listo", a number, and "como siempre" or "por favor" at its end. Any other word and it is no request.
const ASKS = /^\s*(?:listo[\s,.]*)?(?:(?:hazme|dame)\s+(?:la|las)\s+preguntas?(?:\s+\d+)?|pregunta(?:\s+\d+)?|siguiente)(?:\s+(?:como siempre|por favor))?[\s.!]*$/i;
let asksFor = 0;
let longAsksFor = 0;
for (const row of shown) {
  const last = [...his].reverse().find((one) => one.at <= row.at);
  const asks = last !== undefined && !last.answered && ASKS.test(last.text) && row.at - last.at < 5 * 60000;
  if (asks) { asksFor += 1; console.log(`  followed a request:${local(row.at)} ${Math.round((row.at - last.at) / 1000)}s after, waited ${Math.round(row.wait / 60000)}m: "${last.text.slice(0, 110)}"`); }
  if (asks && row.wait > 15 * 60000) longAsksFor += 1;
  if (row.wait > 120 * 60000) console.log(`${local(row.at)} waited ${Math.round(row.wait / 60000)}m, options ${row.options.join('+')}; his last entry ${Math.round((row.at - last.at) / 1000)}s before, ${last.answered ? 'an answer to a question' : 'typed'}: "${last.text.slice(0, 90)}"`);
}
const long = shown.filter((row) => row.wait > 15 * 60000);
console.log(`shown ${shown.length}; asked under 5m after a typed entry of his that is a request: ${asksFor}, of them waited over 15m: ${longAsksFor}`);
console.log(`of the ${long.length} that waited over 15m: two options ${long.filter((row) => row.options.every((n) => n === 2)).length}, three or four ${long.filter((row) => row.options.some((n) => n > 2)).length}`);
const near = shown.filter((row) => row.sinceHis !== null && row.sinceHis < 120000);
console.log(`asked under 2m after his last entry: after typed ${near.filter((row) => !row.afterAnswer).length} (over 15m: ${near.filter((row) => !row.afterAnswer && row.wait > 15 * 60000).length}), after an answer ${near.filter((row) => row.afterAnswer).length} (over 15m: ${near.filter((row) => row.afterAnswer && row.wait > 15 * 60000).length})`);
```

## `words.mjs`

```js
// Read-only: his typed words about questions in the lead's transcripts, and the notices that reached the lead while a
// question held it. Usage: node words.mjs <worktree>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const worktree = process.argv[2];
const lib = (file) => import(pathToFileURL(path.join(worktree, 'bin', 'lib', file)).href);
const { parseTranscript, questionCallsOf, quoteEntry } = await lib('sessions.mjs');
const { linesHolding } = await lib('person-times.mjs');
const home = os.homedir();
const dir = path.join(home, '.claude', 'projects', 'D--js-harness');
const local = (ms) => new Date(ms - 5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');

const ABOUT = /pregunt/i;
const HOW = /(esper|bloque|retien|deten|detuv|parad|quiet|no avanz|me fui|me voy|sin respuesta|tablero|celular|tel[eé]fono|bot[oó]n|notific|tarjeta|formato|aqu[ií]|ac[aá]\b|siempre)/i;
for (const file of ['65318fd5-80e7-4bb8-92b5-06737140185b', '0f71b2c6-cbce-43ca-a031-276a4b2c381f', 'ea85ec35-82e1-4aa9-abe3-98bd153a50b0']) {
  const full = path.join(dir, `${file}.jsonl`);
  if (!fs.existsSync(full)) { console.log(`${file}: not on disk`); continue; }
  const text = fs.readFileSync(full, 'utf8');
  let offset = 0;
  const lineOf = new Map();
  const wanted = linesHolding(text, ['"human"']);
  // The line number of each kept line, by one pass over the text.
  let number = 1;
  let at = 0;
  for (const line of wanted) {
    const start = text.indexOf(line, offset);
    for (let found = text.indexOf('\n', at); found !== -1 && found < start; found = text.indexOf('\n', found + 1)) { number += 1; at = found + 1; }
    lineOf.set(line, number);
    offset = start + line.length;
  }
  const entries = parseTranscript(wanted.join('\n')).entries;
  const calls = questionCallsOf(entries);
  let index = 0;
  for (const line of wanted) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    index += 1;
    const quote = quoteEntry(entry, calls);
    if (!quote.person || quote.answered || typeof quote.text !== 'string') continue;
    if (!ABOUT.test(quote.text) || !HOW.test(quote.text)) continue;
    const words = quote.text.replace(/\s+/g, ' ');
    const where = words.search(ABOUT);
    console.log(`${file.slice(0, 8)}:${lineOf.get(line)} ${local(Date.parse(quote.at))} | ${words.slice(Math.max(0, where - 160), where + 260)}`);
  }
}

// The notices that reached the orchestrator while a question held it more than 15 minutes.
const replay = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[1]), 'replay.json'), 'utf8'));
const notices = fs.readFileSync(path.join(home, '.js-harness', 'channel', 'D--js-harness.jsonl'), 'utf8').split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
const toLead = notices.filter((one) => one.to?.role === 'orchestrator' && typeof one.at === 'string').map((one) => ({ at: Date.parse(one.at), kind: one.kind, pr: one.pr ?? null }));
const ready = new Set();
let total = {};
let withSome = 0;
const long = replay.rows.filter((row) => row.wait > 15 * 60000);
for (const row of long) {
  const during = toLead.filter((one) => one.at > row.at && one.at < row.result);
  if (during.length > 0) withSome += 1;
  for (const one of during) total[one.kind] = (total[one.kind] ?? 0) + 1;
  for (const one of during) if (one.kind === 'ready' && one.pr !== null) ready.add(one.pr);
  if (row.wait > 120 * 60000) console.log(`held ${local(row.at)} for ${Math.round(row.wait / 60000)}m: notices to the lead meanwhile ${during.length} ${JSON.stringify(during.reduce((kinds, one) => ({ ...kinds, [one.kind]: (kinds[one.kind] ?? 0) + 1 }), {}))}`);
}
console.log(`over the ${long.length} calls that waited more than 15m: notices to the lead meanwhile ${JSON.stringify(total)}; calls with at least one: ${withSome}`);
console.log(`the pull requests those ready notices name: ${JSON.stringify([...ready])}`);
```

## `queued.mjs`

```js
// Read-only: what the host queued for the lead while a question of its own was open over 15 minutes, by kind, and
// whether the question returned within two seconds of it. Usage: node queued.mjs   (after replay.mjs --json)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = path.join(os.homedir(), '.claude', 'projects', 'D--js-harness');
const replay = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[1]), 'replay.json'), 'utf8'));
const FILES = { '0f71b2c6': '0f71b2c6-cbce-43ca-a031-276a4b2c381f', ea85ec35: 'ea85ec35-82e1-4aa9-abe3-98bd153a50b0' };
const queued = [];
for (const [short, file] of Object.entries(FILES)) {
  const text = fs.readFileSync(path.join(dir, `${file}.jsonl`), 'utf8');
  let from = 0;
  for (let found = text.indexOf('"type":"queue-operation"', from); found !== -1; found = text.indexOf('"type":"queue-operation"', from)) {
    const start = text.lastIndexOf('\n', found) + 1;
    const end = text.indexOf('\n', found);
    from = end < 0 ? text.length : end + 1;
    let entry;
    try { entry = JSON.parse(text.slice(start, end < 0 ? undefined : end)); } catch { continue; }
    if (entry.operation !== 'enqueue' || typeof entry.timestamp !== 'string') continue;
    const content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content ?? '');
    const kind = content.includes('<task-notification') ? 'task end' : content.includes('<cross-session-message') ? 'message of a session' : /^\s*</.test(content) ? 'other host text' : 'typed by him';
    queued.push({ file: short, at: Date.parse(entry.timestamp), kind });
  }
}
const shown = replay.rows.filter((row) => row.wait !== null && !row.outcome.startsWith('refused'));
const totals = {};
const released = {};
for (const row of shown.filter((one) => one.wait > 15 * 60000)) {
  for (const one of queued.filter((item) => item.file === row.file && item.at > row.at && item.at < row.result - 2000)) totals[one.kind] = (totals[one.kind] ?? 0) + 1;
}
for (const row of shown) {
  for (const one of queued.filter((item) => item.file === row.file && item.at > row.at && item.at <= row.result && row.result - item.at <= 2000)) released[`${one.kind} -> ${row.outcome}`] = (released[`${one.kind} -> ${row.outcome}`] ?? 0) + 1;
}
console.log(`queued for the lead while a question was open over 15 minutes, and the question stayed open more than 2s after: ${JSON.stringify(totals)}`);
console.log(`over all ${shown.length} shown: a question that returned within 2s of something queued, by what was queued and how it returned: ${JSON.stringify(released)}`);
```
