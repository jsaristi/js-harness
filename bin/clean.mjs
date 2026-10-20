// `js-harness clean` (odd/tasks/clean.md): lists the regenerable leftovers of the stack with their sizes, read-only;
// `--apply` deletes only the kinds the user confirms and records each deletion; `--measure` is the background measure
// the doctor row reads; `--log` prints the record. The scan, the deletion and the record are bin/lib/clean.mjs.
import os from 'node:os';
import readline from 'node:readline';
import { unknownArgument } from './lib/args.mjs';
import { KIND_IDS, applyKinds, formatBytes, logPath, readLog, remainingAfter, scan, writeMeasure } from './lib/clean.mjs';

export const USAGE = [
  'Usage: js-harness clean [--json] [--home <path>]',
  '       js-harness clean --apply [--kind <id>]... [--home <path>]',
  '       js-harness clean --measure [--home <path>]',
  '       js-harness clean --log [--json] [--home <path>]',
  '',
  'With no flags it lists each known kind of regenerable leftover (why it is safe to delete, each item with its',
  'size) and a total, and deletes nothing. --apply scans again and deletes only the kinds you confirm: in a terminal',
  'it asks y/N per kind; without one it deletes only the kinds named with --kind, and with none named it deletes',
  'nothing (exit 1). Each deletion is appended to ~/.js-harness/clean-log.jsonl, which --log prints. --measure writes',
  'the sizes for the clean row of doctor and deletes nothing. Package caches are cleaned only by their own tools.',
  `Kinds: ${KIND_IDS.join(', ')}.`,
  'Never deleted: ~/.claude/projects, ~/.engram, ~/.js-harness, the current Codex runtime, the running Claude,',
  'anything inside a git worktree, anything off the known list. Exit 0, 1 when nothing was confirmed or a deletion',
  'failed, 2 for a usage error.',
].join('\n');

class CleanArgError extends Error {}

function parseArgs(argv, env, deps) {
  const unknown = unknownArgument(argv, { valued: ['--home', '--kind'], bare: ['--apply', '--measure', '--log', '--json'] });
  if (unknown !== null) throw new CleanArgError(`unknown argument: ${unknown}`);
  const values = (flag) => argv.flatMap((token, i) => {
    if (token !== flag) return [];
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new CleanArgError(`${flag} requires a value`);
    return [value];
  });
  const kinds = values('--kind');
  for (const kind of kinds) if (!KIND_IDS.includes(kind)) throw new CleanArgError(`unknown kind: ${kind}`);
  const args = {
    home: values('--home')[0] ?? env.JS_HARNESS_HOME ?? deps.scan?.home ?? os.homedir(),
    apply: argv.includes('--apply'),
    measure: argv.includes('--measure'),
    log: argv.includes('--log'),
    json: argv.includes('--json'),
    kinds,
  };
  if (kinds.length > 0 && !args.apply) throw new CleanArgError('--kind goes with --apply');
  if ([args.apply, args.measure, args.log].filter(Boolean).length > 1) throw new CleanArgError('--apply, --measure and --log go one at a time');
  return args;
}

/** Asks `question` on the terminal and resolves to whether the answer is `y`. */
function askOnTerminal(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim().toLowerCase() === 'y');
  }));
}

/** A kind as the person reads it before saying yes: its id, size and reason, then each item. */
function kindLines(kind) {
  const size = `${kind.upTo ? 'up to ' : ''}${formatBytes(kind.bytes)}`;
  const items = kind.items.map((item) => `  ${item.path}  ${formatBytes(item.bytes)}`);
  const how = kind.command ? [`  cleaned by: ${kind.command.join(' ')}`] : [];
  return [`${kind.id} ${size}: ${kind.why}`, ...items, ...how];
}

/** The total line: the sum of the kinds whose size is known, and what the pnpm prune may free on top. */
function totalLine(kinds) {
  const known = kinds.filter((kind) => !kind.upTo).reduce((sum, kind) => sum + kind.bytes, 0);
  const upTo = kinds.filter((kind) => kind.upTo).reduce((sum, kind) => sum + kind.bytes, 0);
  return `Total: ${formatBytes(known)}${upTo > 0 ? ` (plus up to ${formatBytes(upTo)} that pnpm store prune may free)` : ''}`;
}

function printLog(home, json, log) {
  const entries = readLog(home);
  if (json) {
    log(JSON.stringify(entries, null, 2));
    return 0;
  }
  if (entries.length === 0) {
    log(`No deletion recorded yet (${logPath(home)}).`);
    return 0;
  }
  for (const entry of entries) {
    log(`${entry.at}  ${entry.kind}  ${entry.result}  ${formatBytes(entry.bytes ?? 0)}  ${entry.path}${entry.error ? `  (${entry.error})` : ''}`);
  }
  return 0;
}

/** `--apply`: the kinds confirmed (named with --kind, or a y/N each in a terminal) are deleted and recorded. */
async function apply(args, scanDeps, { interactive, ask, log, error, now }) {
  if (args.kinds.length === 0 && !interactive) {
    error('js-harness clean --apply: no terminal to ask in and no --kind named: nothing was deleted. Name each kind to delete with --kind <id>.');
    return 1;
  }
  const kinds = scan(scanDeps);
  const chosen = [];
  if (args.kinds.length > 0) {
    for (const id of args.kinds) {
      const kind = kinds.find((found) => found.id === id);
      if (kind) chosen.push(kind);
      else log(`${id}: nothing to delete.`);
    }
  } else {
    for (const kind of kinds) {
      for (const line of kindLines(kind)) log(line);
      if (await ask(`Delete ${kind.id} (${kind.upTo ? 'up to ' : ''}${formatBytes(kind.bytes)})? [y/N] `)) chosen.push(kind);
    }
  }
  if (chosen.length === 0) {
    log('Nothing deleted.');
    return 0;
  }
  const results = applyKinds(chosen, { ...scanDeps, now });
  writeMeasure(scanDeps.home, remainingAfter(kinds, results), now());
  const deleted = results.filter((entry) => entry.result === 'deleted');
  const freed = deleted.reduce((sum, entry) => sum + entry.bytes, 0);
  for (const entry of results.filter((found) => found.result !== 'deleted')) error(`${entry.kind}: ${entry.result}: ${entry.path} (${entry.error})`);
  log(`Deleted ${deleted.length} of ${results.length} (freed ${formatBytes(freed)}); record: ${logPath(scanDeps.home)}`);
  return deleted.length === results.length ? 0 : 1;
}

/** `js-harness clean`. `deps`: `scan` (the scan's deps: tmpdir, platform, now, run), `interactive`, `ask`, `log`,
 * `error`. */
export async function cleanMain(argv, env = process.env, deps = {}) {
  const log = deps.log ?? ((line) => console.log(line));
  const error = deps.error ?? ((line) => console.error(line));
  let args;
  try {
    args = parseArgs(argv, env, deps);
  } catch (err) {
    if (!(err instanceof CleanArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const scanDeps = { ...deps.scan, home: args.home };
  const now = scanDeps.now ?? (() => new Date());
  if (args.log) return printLog(args.home, args.json, log);
  if (args.measure) {
    writeMeasure(args.home, scan(scanDeps), now(), { onlyIfHome: true });
    return 0;
  }
  if (args.apply) {
    const interactive = deps.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
    return apply(args, scanDeps, { interactive, ask: deps.ask ?? askOnTerminal, log, error, now });
  }
  const kinds = scan(scanDeps);
  writeMeasure(args.home, kinds, now());
  if (args.json) {
    const known = kinds.filter((kind) => !kind.upTo).reduce((sum, kind) => sum + kind.bytes, 0);
    log(JSON.stringify({ total: known, kinds }, null, 2));
    return 0;
  }
  if (kinds.length === 0) {
    log('No regenerable leftovers found.');
    return 0;
  }
  for (const kind of kinds) for (const line of kindLines(kind)) log(line);
  log(totalLine(kinds));
  log('Nothing was deleted. js-harness clean --apply asks y/N per kind; --apply --kind <id> deletes only the kinds named.');
  return 0;
}
