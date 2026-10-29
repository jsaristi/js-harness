#!/usr/bin/env node
// `js-harness stretch` (odd/tasks/stretch-protocol.md): a stretch of work measured from the records. `open` checks the
// lead's plan, records it and prints the departure: what will run, its hours as written and as the last stretches
// correct them, and whether the queued work fills the stretch. `bind` names the session a queued item got. `status`
// measures the open stretch now, and with --goals runs its goals; `close` runs them, measures and records the stretch
// closed, which is what the next estimates learn from. The record is one JSON line an event under the throughput
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
import { headBefore, momentAt, pullRequestsOf, readRef } from './lib/report-git.mjs';
import { compareMaps, comparePlans } from './lib/report-pages.mjs';
import { ruleValue } from './lib/rules.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { corrections, gateRuns, itemMeasure, laneOut, lostHoursOf, parsePlan, scaled, sessionTrail, stretchLost } from './lib/stretch.mjs';
import { goalShares, outsidePlan, timelineOf, workShare } from './lib/stretch-moments.mjs';
import { renderDeparture, renderReturn } from './lib/stretch-render.mjs';
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
  '       js-harness stretch status [--goals] [--json] [--html <file>]',
  '       js-harness stretch close [--json] [--html <file>]',
  '       (each also takes --cwd <path> and --home <path>)',
  '  A stretch is the work run while the user is away, or any stretch the lead plans. Its record is',
  '    <home>/.js-harness/throughput/<project>/stretches.jsonl, one line an event, which uninstall keeps.',
  '  open: reads the plan, a JSON object { hours, slots, goals: [{ id, text, command }], items: [{ id, title, kind,',
  '    hours: [low, high], session?, waitsFor? }], waits?: [text] }. A goal is met when its command exits 0. An item is',
  '    one session\'s work: kind is design, build, verify or docs; hours the work left now; session its label (JH 71)',
  '    once it has one; waitsFor what of the user it cannot start without, which keeps it out of the lanes. It prints',
  '    the departure: each estimate as written and as the last closed stretches correct it, the items in slots lanes,',
  '    and whether they fill the hours. Exit 1 while another stretch is open (close it first), 2 for a plan it refuses.',
  '  bind: names the session a queued item got once it started. Exit 1 with no stretch open, an unknown item, or a',
  '    session another item holds.',
  '  status: the open stretch measured now from the records: each item from its session\'s first record (or the',
  '    opening) to its first closed notice, its removal, its last record once silent past the rule session-stall, or',
  '    now; its lost time the failed gates of its session inside that span. --goals also runs each goal, one at a',
  '    time in the main checkout, and records the result. Exit 1 with no stretch open.',
  '  close: runs the goals, measures and records the stretch closed, and prints the return. Exit 0 whether or not',
  '    the goals were met; exit 1 with no stretch open.',
  '  --json prints the view as JSON; --html <file> writes it as the HTML fragment the lead shows in the chat.',
].join('\n');

class StretchArgError extends Error {}

const VERBS = new Set(['open', 'bind', 'status', 'close']);
const VALUED = { '--plan': 'plan', '--html': 'html', '--cwd': 'cwd', '--home': 'home' };
const ALLOWED = { open: ['plan', 'json', 'html'], bind: [], status: ['goals', 'json', 'html'], close: ['json', 'html'] };

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (!VERBS.has(verb)) throw new StretchArgError(verb === undefined ? 'a verb is required: open, bind, status or close' : `unknown argument: ${verb}`);
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--json' || token === '--goals') {
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
    if (verb === 'bind' && !token.startsWith('-') && positional.length < 2) {
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
  const mine = events.filter((event) => event.id === open.id);
  const checks = mine.filter((event) => event.event === 'check');
  return { open, binds: mine.filter((event) => event.event === 'bind'), check: checks.at(-1) ?? null, checks, events: mine };
}

/** The items of every closed stretch, oldest first: what the corrections learn from. */
const historyOf = (events) => events.filter((event) => event.event === 'close').flatMap((event) => event.items ?? []);

/** The items of the open stretch with each bind applied and its corrected estimate. */
function itemsOf({ open, binds }) {
  return open.plan.items.map((item) => {
    const bound = binds.findLast((bind) => bind.item === item.id);
    const correction = open.corrections[item.kind];
    return { ...item, session: bound?.session ?? item.session, correction, corrected: scaled(item.hours, correction.factor) };
  });
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
  const records = readRecords(ctx);
  const openedAt = Date.parse(stretch.open.at);
  const end = stretch.closedAt ?? now;
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

function emit(ctx, flags, view, render, lines) {
  if (flags.html) {
    const file = path.resolve(ctx.cwd, flags.html);
    ctx.fileSystem.mkdirSync(path.dirname(file), { recursive: true });
    ctx.fileSystem.writeFileSync(file, render(view), 'utf8');
  }
  // With --json the output is the JSON alone, so a reader can parse it whole.
  if (flags.json) return ctx.out(JSON.stringify(view, null, 2));
  for (const line of lines(view)) ctx.out(line);
  if (flags.html) ctx.out(`html: ${path.resolve(ctx.cwd, flags.html)}`);
}

const range = ([low, high]) => (low === high ? `${low} h` : `${low}-${high} h`);

function departureLines(view) {
  return [
    `stretch ${view.id}: ${view.hours} h, back at ${view.returnAt}`,
    `queued ${range(view.queued)} in ${view.lanes.length} lanes; ${view.fills ? 'it fills the stretch' : `${view.idle.hours} session-hours idle from hour ${view.idle.from}`}`,
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
    `timeline: ${moments.timeline.length} events`,
    ...Object.entries(moments.unavailable).map(([name, why]) => `  ${name} could not be read: ${why}`),
  ];
}

function openCommand(ctx, flags, events) {
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
  const head = named.error ? null : headBefore(ctx.run, ctx.root, named.ref, ctx.now());
  const open = { event: 'open', id: at, at, head, plan: read.plan, corrections: corrections(historyOf(events)) };
  appendEvent(ctx.file, ctx.fileSystem, open);
  const items = itemsOf({ open, binds: [] });
  const view = {
    id: open.id,
    openedAt: at,
    returnAt: new Date(Date.parse(at) + read.plan.hours * 3_600_000).toISOString(),
    hours: read.plan.hours,
    slots: read.plan.slots,
    items,
    ...laneOut(items, read.plan),
    goals: goalsOf({ open, check: null }),
    waits: read.plan.waits,
    map: head === null ? null : momentAt(ctx.run, ctx.root, head).map ?? null,
  };
  emit(ctx, flags, view, renderDeparture, departureLines);
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
  const moments = momentsOf(ctx, stretch, view, now);
  if (closing) recordPage(ctx, view, moments);
  emit(ctx, flags, { ...view, state: closing ? 'closed' : 'open', moments }, renderReturn, viewLines);
  return 0;
}

/** What the return says of the plan as a whole (odd/tasks/visual-pages.md): the shares of the planned met, the work
 * sessions outside the plan, the map and the plan steps at the opening and now, and the timeline. Read here, not in
 * `measure`, so the live board's check stays cheap. What git cannot give is in `unavailable` with why. */
function momentsOf(ctx, stretch, view, now) {
  const openedAt = Date.parse(stretch.open.at);
  const unavailable = {};
  const head = { open: null, now: null, reconstructed: false };
  let map = null;
  let plans = [];
  let prs = [];
  const named = readRef(ctx.run, ctx.root);
  if (named.error) unavailable.git = named.error;
  else {
    head.open = stretch.open.head ?? headBefore(ctx.run, ctx.root, named.ref, openedAt);
    head.reconstructed = !stretch.open.head && head.open !== null;
    head.now = headBefore(ctx.run, ctx.root, named.ref, now);
    const before = head.open === null ? null : momentAt(ctx.run, ctx.root, head.open);
    const after = head.now === null ? null : momentAt(ctx.run, ctx.root, head.now);
    if (after === null || after.unavailable) unavailable.map = after?.unavailable ?? 'the default branch has no commit at this time';
    else {
      const usable = before !== null && !before.unavailable ? before : null;
      map = compareMaps(usable?.map ?? null, after.map);
      plans = comparePlans(usable?.plans ?? [], after.plans, { before: usable?.tasks ?? {}, after: after.tasks });
    }
    const listed = pullRequestsOf(ctx.run, ctx.root, named.ref, { from: openedAt, to: now });
    if (listed.error) unavailable.merges = listed.error;
    else prs = listed;
  }
  const channel = readNotices(ctx.home, ctx.slug, { readFile: (file) => ctx.fileSystem.readFileSync(file, 'utf8') });
  const failures = [
    ...view.items.flatMap((item) => item.failures.map((one) => ({ ...one, who: item.session ?? item.title }))),
    ...view.failures.map((one) => ({ ...one, who: 'orchestrator' })),
  ];
  return {
    head,
    goals: goalShares(stretch.open.plan.goals, stretch.checks, Date.parse(view.returnAt)),
    work: workShare(view.items),
    outside: outsidePlan(channel.notices, view.items, { from: openedAt, to: now }),
    map,
    plans,
    timeline: timelineOf({ from: openedAt, to: now, prs, notices: channel.notices, failures, events: stretch.events }),
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
  const ctx = { cwd: defaultCwd, root, home, slug, file: stretchFile(home, slug), env, now, run, fileSystem, readCodexRuns, readLands, runGoal, out: stdout, err: stderr };
  let events;
  try {
    events = readEvents(ctx.file, fileSystem);
  } catch (err) {
    stderr(`js-harness stretch: ${ctx.file} cannot be read (${err.code ?? err.message})`);
    return 1;
  }
  try {
    if (parsed.verb === 'open') return openCommand(ctx, parsed.flags, events);
    if (parsed.verb === 'bind') return bindCommand(ctx, parsed.positional, events);
    return await statusCommand(ctx, parsed.flags, events, parsed.verb === 'close');
  } catch (err) {
    if (!(err instanceof StretchArgError)) throw err;
    stderr(`js-harness stretch: ${err.message}\n\n${USAGE}`);
    return 2;
  }
}
