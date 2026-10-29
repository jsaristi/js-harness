#!/usr/bin/env node
// `js-harness stretch` (odd/tasks/stretch-protocol.md): a stretch of work measured from the records. `open` checks the
// lead's plan, records it and prints the departure: what will run, its hours as written and as the last stretches
// correct them, and whether the queued work fills the stretch. `bind` names the session a queued item got. `status`
// measures the open stretch now, and with --goals runs its goals; `close` runs them, measures and records the stretch
// closed, which is what the next estimates learn from. `explain` records, with the commit or notice that says it, why
// a goal, an item or a failure went wrong and how it is fixed; `show` gives a closed stretch's return again. The record is
// one JSON line an event under the throughput
// folder, which `uninstall` keeps. `--html` writes the view as the fragment the lead shows in the chat.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordFileOf } from './lib/background.mjs';
import { readNotices } from './lib/channel.mjs';
import { codexReviewRunsPath } from './lib/codex-review-runs.mjs';
import { readGateLog } from './lib/gate-log.mjs';
import { harnessHome } from './lib/home.mjs';
import { appendPage, pagesFile } from './lib/pages-record.mjs';
import { parseRoadmap } from './lib/progress.mjs';
import { gitRead, headBefore, momentAt, pullRequestsOf, readRef } from './lib/report-git.mjs';
import { compareMaps, comparePlans, planOf } from './lib/report-pages.mjs';
import { ruleValue } from './lib/rules.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { corrections, gateRuns, itemMeasure, laneOut, lostHoursOf, parsePlan, scaled, sessionTrail, stretchLost } from './lib/stretch.mjs';
import { forecastNow, forecastOf, resolveClose } from './lib/stretch-forecast.mjs';
import { goalShares, outsidePlan, timelineOf, workShare } from './lib/stretch-moments.mjs';
import { recordPageRendered } from './lib/pages-rendered.mjs';
import { renderDeparture, renderReturn } from './lib/stretch-render.mjs';
import { failuresOf, problemsOf } from './lib/stretch-why.mjs';
import { codexFacts, landFacts } from './lib/throughput.mjs';
import { readLandRecord, readRecordLines } from './throughput.mjs';

/** The Codex review runs of the repository at `root`, read so that a record there and unreadable throws:
 * `readCodexReviewRuns` reads it as none, which would show its failures as no failure. */
const readCodexRunRecord = (root, run, fileSystem) => readRecordLines(codexReviewRunsPath(root, { spawn: run }), fileSystem);

export const RECORD_SCHEMA = 'js-harness.stretch/v1';

// Each goal runs this long at most: a goal is a cheap read, held to the limit a done-when command has.
const GOAL_TIMEOUT_MINUTES = ruleValue('contract-run-timeout', 'minutes');

export const USAGE = [
  'Usage: js-harness stretch open --plan <file> [--json] [--html <file>]',
  '       js-harness stretch bind <item> <session>',
  '       js-harness stretch closes <item> <phase or plan> <step>',
  '       js-harness stretch status [--goals] [--json] [--html <file>]',
  '       js-harness stretch close [--json] [--html <file>]',
  '       js-harness stretch explain <goal, item or failure:<time>> --source <commit:hash|notice:at> [--why <text>]',
  '                                  [--fix <text>] [--fixed | --open <text>] [--stretch <id>]',
  '       js-harness stretch show [--stretch <id>] [--json] [--html <file>]',
  '       (each also takes --cwd <path> and --home <path>)',
  '  A stretch is the work run while the user is away, or any stretch the lead plans. Its record is',
  '    <home>/.js-harness/throughput/<project>/stretches.jsonl, one line an event, which uninstall keeps.',
  '  open: reads the plan, a JSON object { hours, slots, goals: [{ id, text, command }], items: [{ id, title, kind,',
  '    hours: [low, high], session?, waitsFor?, closes?: [{ in, step }] }], waits?: [text] }. A goal is met when its',
  '    command exits 0. An item is one session\'s work: kind is design, build, verify or docs; hours the work left now;',
  '    session its label (JH 71) once it has one; waitsFor what of the user it cannot start without, which keeps it out',
  '    of the lanes; closes the rows of the roadmap it closes, each a phase of its checklist and the start of one open',
  '    step\'s text, or a plan section (F8 plan) and a step id not done (S13). It prints the departure: each estimate as',
  '    written and as the last closed stretches correct it, the items in slots lanes, whether they fill the hours, and',
  '    the forecast: the map\'s share now and at the return if the items close, by the middle of their estimates, with',
  '    the range of their two ends. Exit 1 while another stretch is open (close it first), 2 for a plan it refuses.',
  '    The titles and goal texts reach the pages as written, never translated: the lead writes them in the user\'s',
  '    language.',
  '  bind: names the session a queued item got once it started. Exit 1 with no stretch open, an unknown item, or a',
  '    session another item holds.',
  '  closes: names one more row an item of the open stretch closes, as an item\'s closes does, checked against the map',
  '    at its opening; the forecast of status and close reads it. Exit 1 with no stretch open, an unknown item, or a row',
  '    the map at the opening does not hold open.',
  '  status: the open stretch measured now from the records: each item from its session\'s first record (or the',
  '    opening) to its first closed notice, its removal, its last record once silent past the rule session-stall, or',
  '    now; its lost time the failed gates of its session inside that span. --goals also runs each goal, one at a',
  '    time in the main checkout, and records the result. Exit 1 with no stretch open.',
  '  close: runs the goals, measures and records the stretch closed, and prints the return. Exit 0 whether or not',
  '    the goals were met; exit 1 with no stretch open.',
  '  explain: records why a goal, an item or a failure of the stretch went wrong, how it was or can be fixed (--fixed',
  '    when it was), or why it is not (--open), with its source: commit:<hash> git knows, or notice:<at> of the',
  '    channel. A goal and an item are named by id (goal:<id> or item:<id> when both share it), a failure by its start,',
  '    failure:<HH:MM> or failure:<time> as the return shows it, or failure:<time> its record holds, which tells apart',
  '    two cut to the opening. The return shows it beside its row, over what the records say alone. It explains the',
  '    open stretch, else the last closed one, or the one --stretch <id> names; two whose records start in the same',
  '    millisecond share that name and one explanation. Exit 1 for an unknown target, a start two failures share',
  '    whose records start apart (the message names each by its record\'s start), or a source no record holds.',
  '  show: the return of the last closed stretch, or of --stretch <id>, measured again at its close from its records.',
  '    It runs no goal and records nothing. Exit 1 with no closed stretch, or for an open one (use status).',
  '  --json prints the view as JSON; --html <file> writes it as the HTML fragment the lead shows in the chat, and puts',
  '    it in the rendered record (stretch-departure, stretch-status or stretch-return), so it is shown unchanged.',
].join('\n');

class StretchArgError extends Error {}

const VERBS = new Set(['open', 'bind', 'closes', 'status', 'close', 'explain', 'show']);
const VALUED = { '--plan': 'plan', '--html': 'html', '--cwd': 'cwd', '--home': 'home', '--source': 'source', '--why': 'why', '--fix': 'fix', '--open': 'open', '--stretch': 'stretch' };
const ALLOWED = {
  open: ['plan', 'json', 'html'],
  bind: [],
  closes: [],
  status: ['goals', 'json', 'html'],
  close: ['json', 'html'],
  explain: ['source', 'why', 'fix', 'fixed', 'open', 'stretch'],
  show: ['stretch', 'json', 'html'],
};
// How many positional arguments each verb takes: bind an item and a session, closes an item and its row, explain its
// target.
const POSITIONAL = { bind: 2, closes: 3, explain: 1 };

/** An explanation's `--source`: `commit:<hash>` or `notice:<at>`, as `{ kind, ref }`. */
function sourceArg(value) {
  const match = /^(commit|notice):(.+)$/.exec(value);
  if (!match) throw new StretchArgError(`--source is commit:<hash> or notice:<at>, not ${value}`);
  return { kind: match[1], ref: match[2] };
}

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (!VERBS.has(verb)) throw new StretchArgError(verb === undefined ? 'a verb is required: open, bind, status or close' : `unknown argument: ${verb}`);
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--json' || token === '--goals' || token === '--fixed') {
      flags[token.slice(2)] = true;
      continue;
    }
    if (Object.hasOwn(VALUED, token)) {
      const value = rest[i + 1];
      if (value === undefined || value === '' || value.startsWith('--')) throw new StretchArgError(`${token} requires a value`);
      flags[VALUED[token]] = value;
      i += 1;
      continue;
    }
    if (!token.startsWith('-') && positional.length < (POSITIONAL[verb] ?? 0)) {
      positional.push(token);
      continue;
    }
    throw new StretchArgError(`unknown argument: ${token}`);
  }
  for (const name of Object.keys(flags)) {
    if (!['cwd', 'home', ...ALLOWED[verb]].includes(name)) throw new StretchArgError(`unknown argument: --${name}`);
  }
  if (verb === 'open' && flags.plan === undefined) throw new StretchArgError('open requires --plan <file>');
  if (verb === 'bind' && positional.length !== 2) throw new StretchArgError('bind takes an item and a session: bind W3 "JH 74"');
  if (verb === 'closes' && positional.length !== 3) throw new StretchArgError('closes takes an item, a phase or a plan, and a step: closes W3 "Review and release" "The lead\'s manual steps"');
  if (verb === 'explain') {
    if (positional.length !== 1) throw new StretchArgError('explain takes a goal, an item or failure:<time>: explain G2 --source commit:<hash> --why <text>');
    if (flags.source === undefined) throw new StretchArgError('explain requires --source commit:<hash> or notice:<at>: an explanation is a record\'s');
    flags.source = sourceArg(flags.source);
    if (![flags.why, flags.fix, flags.open, flags.fixed].some(Boolean)) throw new StretchArgError('explain requires --why, --fix, --open or --fixed');
    if (flags.fixed && flags.open !== undefined) throw new StretchArgError('--fixed and --open cannot go together: it is fixed or it is not');
  }
  return { verb, flags, positional };
}

/** The stretch record's file for the project `slug` under `home`: beside the throughput days. */
export const stretchFile = (home, slug) => path.join(home, '.js-harness', 'throughput', slug, 'stretches.jsonl');

/** The events of the record, oldest first; none when there is no file. A line that is no event is left out. */
function readEvents(file, fileSystem) {
  let text;
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return text.split(/\r?\n/).flatMap((line) => {
    try {
      const event = JSON.parse(line);
      return event?.schema === RECORD_SCHEMA && typeof event.id === 'string' ? [event] : [];
    } catch {
      return [];
    }
  });
}

function appendEvent(file, fileSystem, event) {
  fileSystem.mkdirSync(path.dirname(file), { recursive: true });
  let text = '';
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  // A line left without its newline (a writer stopped mid-line) is ended first, so the new event is whole.
  const unterminated = text !== '' && !text.endsWith('\n');
  fileSystem.appendFileSync(file, `${unterminated ? '\n' : ''}${JSON.stringify({ schema: RECORD_SCHEMA, ...event })}\n`, 'utf8');
}

/** The open stretch of `events`: the last `open` with no `close` after it, with its binds and goal checks; `null`. */
function openStretch(events) {
  const open = events.findLast((event) => event.event === 'open');
  if (!open || events.some((event) => event.event === 'close' && event.id === open.id)) return null;
  return stretchOf(events, open);
}

/** The stretch `open` opened, from its events: its binds, goal checks and, once closed, its `close` and `closedAt`. */
function stretchOf(events, open) {
  const mine = events.filter((event) => event.id === open.id);
  const checks = mine.filter((event) => event.event === 'check');
  const close = mine.find((event) => event.event === 'close') ?? null;
  return {
    open,
    binds: mine.filter((event) => event.event === 'bind'),
    closes: mine.filter((event) => event.event === 'closes'),
    check: checks.at(-1) ?? null,
    checks,
    events: mine,
    close,
    ...(close ? { closedAt: Date.parse(close.at) } : {}),
  };
}

/** The stretch an `explain` or a `show` names: the one `id` opened, else the open one when `open` allows it, else the
 * last closed one; `null` when there is none. */
function namedStretch(events, id, { open: openAllowed }) {
  const opens = events.filter((event) => event.event === 'open');
  if (id !== undefined) {
    const named = opens.find((event) => event.id === id);
    return named ? stretchOf(events, named) : null;
  }
  const current = openAllowed ? openStretch(events) : null;
  if (current) return current;
  const closed = opens.map((open) => stretchOf(events, open)).filter((one) => one.close);
  return closed.at(-1) ?? null;
}

/** The items of every closed stretch, oldest first: what the corrections learn from. */
const historyOf = (events) => events.filter((event) => event.event === 'close').flatMap((event) => event.items ?? []);

/** The items of the open stretch with each bind applied, the rows each `closes` event added to its own, and its
 * corrected estimate. */
function itemsOf({ open, binds, closes = [] }) {
  return open.plan.items.map((item) => {
    const bound = binds.findLast((bind) => bind.item === item.id);
    const added = closes.filter((one) => one.item === item.id).map((one) => ({ in: one.in, step: one.step }));
    const correction = open.corrections[item.kind];
    return { ...item, ...(added.length ? { closes: [...(item.closes ?? []), ...added] } : {}), session: bound?.session ?? item.session, correction, corrected: scaled(item.hours, correction.factor) };
  });
}

/** The roadmap at `commit` as the forecast reads it: the checklist's phases with their steps, counted as `progress`
 * counts them (`parseRoadmap`), and the plan sections (`planOf`); `{ unavailable }` with why when git cannot show it. */
function roadmapAt(ctx, commit) {
  const shown = gitRead(ctx.run, ctx.root, ['show', `${commit}:docs/ROADMAP.md`]);
  if (shown.error) return { unavailable: shown.error };
  const { phases, done, total } = parseRoadmap(shown.stdout);
  return { phases, done, total, plans: planOf(shown.stdout) };
}

/** The roadmap at the opening of `stretch`: at the commit its `open` recorded, else the default branch's at its time. */
function openingRoadmap(ctx, stretch) {
  if (stretch.open.head) return roadmapAt(ctx, stretch.open.head);
  const named = readRef(ctx.run, ctx.root);
  if (named.error) return { unavailable: named.error };
  const opening = headBefore(ctx.run, ctx.root, named.ref, Date.parse(stretch.open.at));
  if (opening.error) return { unavailable: opening.error };
  return opening.commit ? roadmapAt(ctx, opening.commit) : { unavailable: 'the default branch had no commit at the opening' };
}

/** The forecast of `stretch` from the roadmap at its opening, as its departure made it, with `now`, the stretch
 * measured against it at the commit `head.now`; `{ unavailable }` when the roadmap at the opening cannot be read. */
function forecastMoment(ctx, stretch, head, unavailable) {
  if (head.open === null) return { unavailable: unavailable.opening ?? unavailable.git ?? 'the default branch had no commit at the opening' };
  const opening = roadmapAt(ctx, head.open);
  if (opening.unavailable) return { unavailable: opening.unavailable };
  const items = itemsOf(stretch);
  const forecast = forecastOf({ items, lanes: laneOut(items, stretch.open.plan).lanes, hours: stretch.open.plan.hours, roadmap: opening });
  const current = head.now === null ? { unavailable: unavailable.map ?? 'the default branch has no commit now' } : roadmapAt(ctx, head.now);
  return { ...forecast, now: current.unavailable ? { unavailable: current.unavailable } : forecastNow(forecast, current) };
}

/** The records a measure reads, each `{ unavailable }` with why when it cannot be read. */
function readRecords(ctx) {
  const unavailable = {};
  const channel = readNotices(ctx.home, ctx.slug, { readFile: (file) => ctx.fileSystem.readFileSync(file, 'utf8') });
  if (channel.unavailable) unavailable.channel = channel.unavailable;
  let starts = [];
  try {
    starts = ctx.fileSystem.readFileSync(recordFileOf(ctx.home), 'utf8').split(/\r?\n/).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch (err) {
    if (err.code !== 'ENOENT') unavailable.background = err.code ?? err.message;
  }
  const log = readGateLog(ctx.home, { fileSystem: ctx.fileSystem });
  if (log.unavailable) unavailable['gate log'] = log.unavailable.join(', ');
  const all = { from: 0, to: Infinity };
  let lands = [];
  try {
    lands = landFacts(ctx.readLands(ctx.root), all);
  } catch (err) {
    unavailable.lands = err.message;
  }
  let codex = [];
  try {
    codex = codexFacts(ctx.readCodexRuns(ctx.root), all);
  } catch (err) {
    unavailable.codex = err.message;
  }
  return { notices: channel.notices, starts, gates: gateRuns(log.events ?? []), lands, codex, unavailable };
}

// What no record holds, said in the view instead of guessed: a rewrite after a review, a wait for the user's answer,
// work a session did without a record. The render words each.
const UNMEASURED = ['review-rewrite', 'answer-wait', 'unrecorded-work'];

const round = (n) => Math.round(n * 100) / 100;
const sum = (values) => round(values.reduce((total, value) => total + value, 0));

/** The view of `stretch` at `now`: its items measured, what failed outside them, the goals as last checked. */
function measure(ctx, stretch, now) {
  const openedAt = Date.parse(stretch.open.at);
  const end = stretch.closedAt ?? now;
  // Only what was recorded by the end: a closed stretch shown again reads as it closed, whatever its sessions did
  // after. Lands and Codex runs are cut to the end by `stretchLost`.
  const read = readRecords(ctx);
  const byEnd = (iso) => Date.parse(iso) <= end;
  const records = { ...read, notices: read.notices.filter((one) => byEnd(one?.at)), starts: read.starts.filter((one) => byEnd(one?.at)), gates: read.gates.filter((one) => byEnd(one.startedAt)) };
  const items = itemsOf(stretch).map((item) => {
    const trail = item.session ? sessionTrail(item.session, { notices: records.notices, starts: records.starts, root: ctx.root }) : null;
    return itemMeasure(item, trail, { openedAt, now: end, gates: records.gates });
  });
  const failures = stretchLost(records, { from: openedAt, to: end, root: ctx.root });
  const counted = items.filter((item) => !item.waitsFor);
  const real = sum(items.map((item) => item.realHours));
  const lost = round(sum(items.map((item) => item.lostHours)) + lostHoursOf(failures));
  return {
    id: stretch.open.id,
    openedAt: stretch.open.at,
    returnAt: new Date(openedAt + stretch.open.plan.hours * 3_600_000).toISOString(),
    at: new Date(end).toISOString(),
    hours: stretch.open.plan.hours,
    elapsedHours: round((end - openedAt) / 3_600_000),
    items,
    failures,
    totals: {
      estimate: [sum(counted.map((item) => item.corrected[0])), sum(counted.map((item) => item.corrected[1]))],
      realHours: real,
      lostHours: lost,
      lostShare: real > 0 ? round(lost / real) : 0,
    },
    goals: goalsOf(stretch),
    waits: stretch.open.plan.waits,
    unmeasured: UNMEASURED,
    unavailable: records.unavailable,
  };
}

/** The goals with their last check: `{ checkedAt, met, total, list }`, each never checked `met: null`. */
function goalsOf({ open, check }) {
  const results = new Map((check?.goals ?? []).map((goal) => [goal.id, goal]));
  const list = open.plan.goals.map((goal) => ({ ...goal, met: results.get(goal.id)?.met ?? null, said: results.get(goal.id)?.said ?? null }));
  return { checkedAt: check?.at ?? null, met: list.filter((goal) => goal.met === true).length, total: list.length, list };
}

/** Runs each goal of the open stretch in the main checkout, one at a time, and records the check. */
async function checkGoals(ctx, stretch) {
  const goals = [];
  for (const goal of stretch.open.plan.goals) {
    const outcome = await ctx.runGoal(goal.command, { cwd: ctx.root, env: { ...process.env, ...ctx.env }, timeout: GOAL_TIMEOUT_MINUTES * 60_000 });
    const met = outcome.status === 0 && !outcome.error;
    const said = met ? 'exit 0' : outcome.error?.code === 'ETIMEDOUT' ? `timed out after ${GOAL_TIMEOUT_MINUTES} min` : outcome.error ? `error ${outcome.error.code ?? outcome.error.message}` : `exit ${outcome.status ?? outcome.signal}`;
    goals.push({ id: goal.id, met, said });
  }
  const check = { event: 'check', id: stretch.open.id, at: new Date(ctx.now()).toISOString(), goals };
  appendEvent(ctx.file, ctx.fileSystem, check);
  return { ...stretch, check, checks: [...stretch.checks, check], events: [...stretch.events, check] };
}

/** Prints `view`, and with --html writes its page and puts it in the rendered record under `page.template`, the
 * stretch's id its subject (odd/tasks/visual-pages.md, T10), so the page shown is the one the command wrote. A record
 * that cannot be written is said and costs the page nothing. */
async function emit(ctx, flags, view, render, lines, page) {
  let rendered = null;
  if (flags.html) {
    const file = path.resolve(ctx.cwd, flags.html);
    ctx.fileSystem.mkdirSync(path.dirname(file), { recursive: true });
    const at = new Date(ctx.now()).toISOString();
    ctx.fileSystem.writeFileSync(file, render(view, { generatedAt: at }), 'utf8');
    rendered = await recordPageRendered({ home: ctx.home, slug: ctx.slug, template: page.template, subject: view.id, path: file, at, head: page.head ?? null }, ctx.recordLoad ? { load: ctx.recordLoad } : {});
  }
  const said = rendered === null ? null : rendered.recorded ? `the page is in the rendered record ${rendered.file} (sha256 ${rendered.recorded.sha256.slice(0, 12)}): show or publish it unchanged` : `the page is not in the rendered record: ${rendered.unavailable}`;
  // With --json the output is the JSON alone, so a reader can parse it whole; what the record says goes to stderr.
  if (flags.json) {
    if (said) ctx.err(said);
    return ctx.out(JSON.stringify(view, null, 2));
  }
  for (const line of lines(view)) ctx.out(line);
  if (flags.html) ctx.out(`html: ${path.resolve(ctx.cwd, flags.html)}; ${said}`);
}

const range = ([low, high]) => (low === high ? `${low} h` : `${low}-${high} h`);

// A share as `progress` prints it: a whole percent, or a dash over nothing.
const percent = (done, total) => (total === 0 ? '—' : `${Math.round((done / total) * 100)}%`);

/** The forecast in one line: the map's share at the opening, at the return by the middle and its range, and, once
 * measured, the share now and the named rows done. */
function forecastLines(forecast) {
  if (!forecast) return [];
  if (forecast.unavailable) return [`forecast: the map could not be read (${forecast.unavailable})`];
  const { total, now } = forecast;
  const lines = [`map ${percent(total.done, total.total)} at the opening; at the return ~${percent(total.forecast, total.total)} (${percent(total.low, total.total)} to ${percent(total.high, total.total)}); ${forecast.named} items name what they close`];
  if (now?.unavailable) lines.push(`  the map now could not be read (${now.unavailable})`);
  else if (now) lines.push(`  now ${percent(now.total.done, now.total.total)}; ${now.forecastDone.done} of ${now.forecastDone.of} forecast rows done; the map gained ${now.gained} rows`);
  return lines;
}

function departureLines(view) {
  return [
    `stretch ${view.id}: ${view.hours} h, back at ${view.returnAt}`,
    `queued ${range(view.queued)} in ${view.lanes.length} lanes; ${view.fills ? 'it fills the stretch' : `${view.idle.hours} session-hours idle from hour ${view.idle.from}`}`,
    ...forecastLines(view.forecast),
    ...view.items.map((item) => `  ${item.id} ${item.title} (${item.kind}${item.session ? `, ${item.session}` : ''}): ${range(item.hours)}, corrected ${range(item.corrected)}${item.waitsFor ? `, waits for ${item.waitsFor}` : ''}`),
    ...view.goals.list.map((goal) => `  goal ${goal.id} ${goal.text}: ${goal.command}`),
  ];
}

function viewLines(view) {
  return [
    `stretch ${view.id}: ${view.elapsedHours} of ${view.hours} h; goals ${view.goals.met} of ${view.goals.total} met${view.goals.checkedAt ? ` at ${view.goals.checkedAt}` : ', not checked yet'}`,
    `estimated ${range(view.totals.estimate)}, real ${view.totals.realHours} h, lost ${view.totals.lostHours} h`,
    ...view.items.map((item) => `  ${item.id} ${item.title}: ${item.state}, ${item.realHours} h of ${range(item.corrected)}, lost ${item.lostHours} h`),
    ...view.goals.list.map((goal) => `  goal ${goal.id} ${goal.met === null ? 'not checked' : goal.met ? 'met' : `not met (${goal.said})`}: ${goal.text}`),
    ...Object.entries(view.unavailable).map(([name, why]) => `  ${name} could not be read: ${why}`),
    ...momentLines(view.moments),
  ];
}

const shareLine = (one) => (one.met === null ? `not measured (${one.unknown} unknown)` : `${one.met} of ${one.of}${one.unknown ? `, ${one.unknown} unknown` : ''}`);

function momentLines(moments) {
  if (!moments) return [];
  const { goals, work, outside, map } = moments;
  return [
    `goals met ${shareLine(goals.met)}; in time ${shareLine(goals.inTime)}; work done ${shareLine(work)}; ${outside.sessions.length} sessions outside the plan`,
    map ? `map ${map.total.before ? `${map.total.before.done}/${map.total.before.total}` : 'no before'} -> ${map.total.after.done}/${map.total.after.total}${moments.head.reconstructed ? ' (the opening commit reconstructed)' : ''}` : 'map not read',
    ...forecastLines(moments.forecast),
    `timeline: ${moments.timeline.length} events`,
    ...Object.entries(moments.unavailable).map(([name, why]) => `  ${name} could not be read: ${why}`),
  ];
}

async function openCommand(ctx, flags, events) {
  if (openStretch(events)) {
    ctx.err(`js-harness stretch: a stretch is open (${openStretch(events).open.id}); close it first with js-harness stretch close`);
    return 1;
  }
  let value;
  try {
    value = JSON.parse(ctx.fileSystem.readFileSync(path.resolve(ctx.cwd, flags.plan), 'utf8'));
  } catch (err) {
    throw new StretchArgError(`the plan ${flags.plan} cannot be read as JSON (${err.code ?? err.message})`);
  }
  const read = parsePlan(value);
  if (read.error) throw new StretchArgError(`the plan is refused: ${read.error}`);
  const at = new Date(ctx.now()).toISOString();
  // The default branch's commit at the opening, so the return compares the map with what existed then.
  const named = readRef(ctx.run, ctx.root);
  const opening = named.error ? { error: named.error } : headBefore(ctx.run, ctx.root, named.ref, ctx.now());
  const head = opening.commit ?? null;
  // Each row an item closes is one the map at the opening holds open; a map git cannot read is said in the forecast.
  const roadmap = head === null ? { unavailable: opening.error ?? 'the default branch has no commit at the opening' } : roadmapAt(ctx, head);
  if (!roadmap.unavailable) {
    for (const item of read.plan.items) {
      for (const entry of item.closes ?? []) {
        const resolved = resolveClose(entry, roadmap);
        if (resolved.error) throw new StretchArgError(`the plan is refused: item ${item.id} closes ${entry.in} / ${entry.step}: ${resolved.error}`);
      }
    }
  }
  const open = { event: 'open', id: at, at, head, plan: read.plan, corrections: corrections(historyOf(events)) };
  appendEvent(ctx.file, ctx.fileSystem, open);
  const items = itemsOf({ open, binds: [] });
  const lanes = laneOut(items, read.plan);
  const view = {
    id: open.id,
    openedAt: at,
    returnAt: new Date(Date.parse(at) + read.plan.hours * 3_600_000).toISOString(),
    hours: read.plan.hours,
    slots: read.plan.slots,
    items,
    ...lanes,
    goals: goalsOf({ open, check: null }),
    waits: read.plan.waits,
    map: head === null ? null : momentAt(ctx.run, ctx.root, head).map ?? null,
    forecast: roadmap.unavailable ? { unavailable: roadmap.unavailable } : forecastOf({ items, lanes: lanes.lanes, hours: read.plan.hours, roadmap }),
  };
  await emit(ctx, flags, view, renderDeparture, departureLines, { template: 'stretch-departure', head });
  return 0;
}

function bindCommand(ctx, [item, session], events) {
  const stretch = openStretch(events);
  if (!stretch) {
    ctx.err('js-harness stretch: no stretch is open');
    return 1;
  }
  const items = itemsOf(stretch);
  if (!items.some((one) => one.id === item)) {
    ctx.err(`js-harness stretch: the open stretch has no item ${item}`);
    return 1;
  }
  const holder = items.find((one) => one.session === session && one.id !== item);
  if (holder) {
    ctx.err(`js-harness stretch: session ${session} is item ${holder.id}'s: an item is one session's work`);
    return 1;
  }
  appendEvent(ctx.file, ctx.fileSystem, { event: 'bind', id: stretch.open.id, at: new Date(ctx.now()).toISOString(), item, session });
  ctx.out(`item ${item} is session ${session}`);
  return 0;
}

/** Records one more row `item` of the open stretch closes, `where` a phase or a plan and `step` the start of one open
 * step's text or a plan step's id, once the map at the opening holds it open. The same row named again is said and not
 * recorded twice. */
function closesCommand(ctx, [item, where, step], events) {
  const stretch = openStretch(events);
  if (!stretch) {
    ctx.err('js-harness stretch: no stretch is open');
    return 1;
  }
  const found = itemsOf(stretch).find((one) => one.id === item);
  if (!found) {
    ctx.err(`js-harness stretch: the open stretch has no item ${item}`);
    return 1;
  }
  if ((found.closes ?? []).some((one) => one.in === where && one.step === step)) {
    ctx.out(`item ${item} already closes ${where} / ${step}`);
    return 0;
  }
  const roadmap = openingRoadmap(ctx, stretch);
  if (roadmap.unavailable) {
    ctx.err(`js-harness stretch: the map at the opening cannot be read (${roadmap.unavailable}), so no row can be checked`);
    return 1;
  }
  const resolved = resolveClose({ in: where, step }, roadmap);
  if (resolved.error) {
    ctx.err(`js-harness stretch: ${resolved.error}`);
    return 1;
  }
  appendEvent(ctx.file, ctx.fileSystem, { event: 'closes', id: stretch.open.id, at: new Date(ctx.now()).toISOString(), item, in: where, step });
  ctx.out(`item ${item} closes ${where}: ${resolved.row.text}`);
  return 0;
}

/** The record an explanation's source names, as the `explain` event keeps it: a commit by its full hash, a notice by
 * its time and sender; `{ error }` when git or the channel holds none. */
function sourceRecord(ctx, { kind, ref }) {
  if (kind === 'commit') {
    const read = gitRead(ctx.run, ctx.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return read.error || !read.stdout.trim() ? { error: `git knows no commit ${ref}` } : { kind, ref: read.stdout.trim() };
  }
  const channel = readNotices(ctx.home, ctx.slug, { readFile: (file) => ctx.fileSystem.readFileSync(file, 'utf8') });
  if (channel.unavailable) return { error: `the channel cannot be read (${channel.unavailable})` };
  const wanted = Date.parse(ref);
  const found = Number.isFinite(wanted) ? channel.notices.find((one) => Date.parse(one.at) === wanted) : undefined;
  return found ? { kind, at: new Date(wanted).toISOString(), from: found.from?.title ?? found.from?.id ?? null } : { error: `the channel holds no notice at ${ref}` };
}

function explainCommand(ctx, flags, [target], events) {
  const stretch = namedStretch(events, flags.stretch, { open: true });
  if (!stretch) {
    ctx.err(`js-harness stretch: ${flags.stretch === undefined ? 'no stretch was opened' : `no stretch ${flags.stretch}`}`);
    return 1;
  }
  const named = explainTarget(ctx, stretch, target);
  if (named.error) {
    ctx.err(`js-harness stretch: ${named.error}`);
    return 1;
  }
  const source = sourceRecord(ctx, flags.source);
  if (source.error) {
    ctx.err(`js-harness stretch: ${source.error}; an explanation is a record's, so it names one that exists`);
    return 1;
  }
  const texts = Object.fromEntries(['why', 'fix', 'open'].filter((name) => flags[name] !== undefined).map((name) => [name, flags[name]]));
  appendEvent(ctx.file, ctx.fileSystem, { event: 'explain', id: stretch.open.id, at: new Date(ctx.now()).toISOString(), kind: named.kind, target: named.target, ...texts, ...(flags.fixed ? { fixed: true } : {}), source });
  ctx.out(`${named.kind} ${named.target} of the stretch ${stretch.open.id} explained, its source ${source.kind} ${source.ref ?? source.at}`);
  return 0;
}

/** The goal, item or failure `target` names in `stretch`, as `{ kind, target }`, or `{ error }`. A goal and an item
 * may share an id: `goal:<id>` or `item:<id>` says which, and a bare id must name only one. A failure is named by its
 * start, `failure:<time>` in full or `failure:<HH:MM>` as the page shows it, among the failures measured to the close,
 * or to now while the stretch is open; a minute two of them start in is refused with the full time of each. */
function explainTarget(ctx, stretch, target) {
  const { id: stretchId, plan } = stretch.open;
  const [, kindAsked, id] = /^(?:(goal|item|failure):)?(.+)$/.exec(target);
  if (kindAsked === 'failure') {
    const failures = failuresOf(measure(ctx, stretch, ctx.now()));
    const minute = /^(\d{2}:\d{2})Z?$/.exec(id)?.[1];
    const wanted = Date.parse(id);
    const named = failures.filter((one) => Date.parse(one.target) === wanted);
    const found = named.length > 0 ? named : failures.filter((one) => (minute ? one.at.slice(11, 16) === minute : Date.parse(one.at) === wanted));
    const targets = [...new Set(found.map((one) => one.target))];
    if (targets.length === 1) return { kind: 'failure', target: targets[0] };
    return { error: targets.length === 0 ? `the stretch ${stretchId} has no failure that starts at ${id}` : `${found.length} failures of the stretch ${stretchId} start at ${id}: name one by the start its record holds, ${found.map((one) => `failure:${one.target} (${one.what}, ${one.who})`).join(' or ')}` };
  }
  const kinds = [['goal', plan.goals], ['item', plan.items]].filter(([kind, list]) => (kindAsked ?? kind) === kind && list.some((one) => one.id === id)).map(([kind]) => kind);
  if (kinds.length === 1) return { kind: kinds[0], target: id };
  return { error: kinds.length === 0 ? `the stretch ${stretchId} has no ${kindAsked ?? 'goal or item'} ${id}` : `the stretch ${stretchId} has both a goal and an item ${id}: name goal:${id} or item:${id}` };
}

async function showCommand(ctx, flags, events) {
  const stretch = namedStretch(events, flags.stretch, { open: false });
  if (!stretch || !stretch.close) {
    ctx.err(`js-harness stretch: ${stretch ? `the stretch ${stretch.open.id} is open; js-harness stretch status shows it` : flags.stretch === undefined ? 'no stretch was closed' : `no stretch ${flags.stretch}`}`);
    return 1;
  }
  const view = measure(ctx, stretch, stretch.closedAt);
  const moments = momentsOf(ctx, stretch, view, stretch.closedAt, { closed: true });
  await emit(ctx, flags, { ...view, state: 'closed', moments }, renderReturn, viewLines, { template: 'stretch-return', head: moments.head.now });
  return 0;
}

async function statusCommand(ctx, flags, events, closing) {
  let stretch = openStretch(events);
  if (!stretch) {
    ctx.err('js-harness stretch: no stretch is open');
    return 1;
  }
  if (flags.goals || closing) stretch = await checkGoals(ctx, stretch);
  const now = ctx.now();
  const view = measure(ctx, stretch, now);
  if (closing) {
    const items = view.items.map(({ id, kind, hours, corrected, realHours, lostHours, state, clipped }) => ({ id, kind, estimate: hours, corrected, realHours, lostHours, state, finished: state === 'finished', clipped }));
    const close = { event: 'close', id: stretch.open.id, at: view.at, items, goals: view.goals, totals: view.totals };
    appendEvent(ctx.file, ctx.fileSystem, close);
    stretch = { ...stretch, events: [...stretch.events, close] };
  }
  const moments = momentsOf(ctx, stretch, view, now, { closed: closing });
  if (closing) recordPage(ctx, view, moments);
  await emit(ctx, flags, { ...view, state: closing ? 'closed' : 'open', moments }, renderReturn, viewLines, { template: closing ? 'stretch-return' : 'stretch-status', head: moments.head.now });
  return 0;
}

/** What the return says of the plan as a whole (odd/tasks/visual-pages.md): the shares of the planned met, the work
 * sessions outside the plan, the map and the plan steps at the opening and now, and the timeline. Read here, not in
 * `measure`, so the live board's check stays cheap. What git cannot give is in `unavailable` with why. */
function momentsOf(ctx, stretch, view, now, { closed }) {
  const openedAt = Date.parse(stretch.open.at);
  const unavailable = {};
  const head = { open: null, now: null, reconstructed: false };
  let map = null;
  let plans = [];
  let prs = [];
  let forecast;
  const named = readRef(ctx.run, ctx.root);
  if (named.error) {
    unavailable.git = named.error;
    forecast = { unavailable: named.error };
  }
  else {
    const opening = stretch.open.head ? { commit: stretch.open.head } : headBefore(ctx.run, ctx.root, named.ref, openedAt);
    const current = headBefore(ctx.run, ctx.root, named.ref, now);
    head.open = opening.commit ?? null;
    head.reconstructed = !stretch.open.head && head.open !== null;
    head.now = current.commit ?? null;
    const before = head.open === null ? null : momentAt(ctx.run, ctx.root, head.open);
    const after = head.now === null ? null : momentAt(ctx.run, ctx.root, head.now);
    // A before that cannot be read is said with why and left unmeasured: read as empty, every step would be new.
    if (opening.error) unavailable.opening = opening.error;
    else if (before?.unavailable) unavailable.opening = before.unavailable;
    if (current.error) unavailable.map = current.error;
    else if (after === null || after.unavailable) unavailable.map = after?.unavailable ?? 'the default branch has no commit at this time';
    else {
      const usable = before !== null && !before.unavailable ? before : null;
      map = compareMaps(usable?.map ?? null, after.map);
      plans = comparePlans(usable?.plans ?? null, after.plans, { before: usable?.tasks ?? {}, after: after.tasks });
    }
    forecast = forecastMoment(ctx, stretch, head, unavailable);
    const listed = pullRequestsOf(ctx.run, ctx.root, named.ref, { from: openedAt, to: now });
    if (listed.error) unavailable.merges = listed.error;
    else prs = listed;
  }
  const channel = readNotices(ctx.home, ctx.slug, { readFile: (file) => ctx.fileSystem.readFileSync(file, 'utf8') });
  const failures = [
    ...view.items.flatMap((item) => item.failures.map((one) => ({ ...one, who: item.session ?? item.title }))),
    ...view.failures.map((one) => ({ ...one, who: 'orquestador' })),
  ];
  return {
    head,
    goals: goalShares(stretch.open.plan.goals, stretch.checks, Date.parse(view.returnAt)),
    work: workShare(view.items),
    outside: outsidePlan(channel.notices, view.items, { from: openedAt, to: now }),
    map,
    plans,
    forecast,
    timeline: timelineOf({ from: openedAt, to: now, prs, notices: channel.notices, failures, events: stretch.events }),
    why: problemsOf({ ...view, state: closed ? 'closed' : 'open' }, { notices: channel.notices, explains: stretch.events.filter((event) => event.event === 'explain') }),
    unavailable,
  };
}

/** Keeps the return's numbers in the page record, so the next page compares with them. A record that cannot be
 * written is said and costs the return nothing. */
function recordPage(ctx, view, moments) {
  const numbers = {
    goals: moments.goals,
    work: { met: moments.work.met, of: moments.work.of },
    outside: moments.outside.sessions.length,
    map: moments.map?.total ?? null,
    steps: moments.plans.flatMap((plan) => plan.steps.map((step) => ({ plan: plan.name, id: step.id, reported: step.after?.reported ?? null, change: step.change }))),
  };
  try {
    appendPage(pagesFile(ctx.home, ctx.slug), { kind: 'stretch', subject: view.id, at: view.at, head: moments.head.now, numbers }, ctx.fileSystem);
  } catch (err) {
    ctx.err(`js-harness stretch: the page record could not be written (${err.code ?? err.message})`);
  }
}

/** The open stretch as the live board shows it, measured at `now` from the records and with the goals as last
 * checked (it runs none): `{ id, openedAt, returnAt, hours, elapsedHours, measuredAt, goals, lostHours, items }`;
 * `null` when none is open; `{ unavailable }` when the record cannot be read. */
export function boardStretch({ home, root, slug, now, run, fileSystem = fs }) {
  let events;
  try {
    events = readEvents(stretchFile(home, slug), fileSystem);
  } catch (err) {
    return { unavailable: err.code ?? err.message };
  }
  const stretch = openStretch(events);
  if (!stretch) return null;
  const ctx = { root, home, slug, fileSystem, readLands: (folder) => readLandRecord(folder, run, fileSystem), readCodexRuns: (folder) => readCodexRunRecord(folder, run, fileSystem) };
  const view = measure(ctx, stretch, now);
  const { met, total, checkedAt } = view.goals;
  return {
    id: view.id,
    openedAt: view.openedAt,
    returnAt: view.returnAt,
    hours: view.hours,
    elapsedHours: view.elapsedHours,
    measuredAt: view.at,
    goals: { met, total, checkedAt },
    lostHours: view.totals.lostHours,
    items: view.items.map(({ id, title, session, state, realHours, corrected, waitsFor }) => ({ id, title, session, state, realHours, corrected, waitsFor: waitsFor ?? null })),
  };
}

export async function stretchMain(
  argv = [],
  env = process.env,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    now = Date.now,
    run = (command, args, options) => spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options }),
    homedir = os.homedir,
    fileSystem = fs,
    readCodexRuns = (root) => readCodexRunRecord(root, run, fileSystem),
    readLands = (root) => readLandRecord(root, run, fileSystem),
    // `runSensor` of `check.mjs`, as `contract run` runs a done-when command: it stops the whole tree at the timeout.
    // Imported when a goal runs, since `check.mjs` is large.
    runGoal = async (command, options) => (await import('./check.mjs')).runSensor(command, options),
    // The rendered record's module, as `recordPageRendered` loads it; the seam the tests stub.
    recordLoad,
  } = {},
) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(USAGE);
    return 0;
  }
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof StretchArgError)) throw err;
    stderr(`js-harness stretch: ${err.message}\n\n${USAGE}`);
    return 2;
  }
  const cwd = path.resolve(defaultCwd, parsed.flags.cwd ?? '.');
  const home = harnessHome({ given: parsed.flags.home, env, cwd: defaultCwd, homedir });
  const root = mainCheckout(run, cwd);
  const slug = projectSlug(root);
  const ctx = { cwd: defaultCwd, root, home, slug, file: stretchFile(home, slug), env, now, run, fileSystem, readCodexRuns, readLands, runGoal, recordLoad, out: stdout, err: stderr };
  let events;
  try {
    events = readEvents(ctx.file, fileSystem);
  } catch (err) {
    stderr(`js-harness stretch: ${ctx.file} cannot be read (${err.code ?? err.message})`);
    return 1;
  }
  try {
    if (parsed.verb === 'open') return await openCommand(ctx, parsed.flags, events);
    if (parsed.verb === 'bind') return bindCommand(ctx, parsed.positional, events);
    if (parsed.verb === 'closes') return closesCommand(ctx, parsed.positional, events);
    if (parsed.verb === 'explain') return explainCommand(ctx, parsed.flags, parsed.positional, events);
    if (parsed.verb === 'show') return await showCommand(ctx, parsed.flags, events);
    return await statusCommand(ctx, parsed.flags, events, parsed.verb === 'close');
  } catch (err) {
    if (!(err instanceof StretchArgError)) throw err;
    stderr(`js-harness stretch: ${err.message}\n\n${USAGE}`);
    return 2;
  }
}
