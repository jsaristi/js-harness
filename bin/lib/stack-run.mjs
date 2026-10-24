// How `stack install` runs a row and `uninstall machine` undoes it (odd/tasks/stack-install.md, D6 and D7): the
// environment a child is given, the runner, what an undo still applies to, and the undo of the records. Every command
// goes through `runWords`, whose default spawn refuses in a test, so no test installs anything.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { underTest } from './manifest.mjs';
import { cmdWord, shownWord } from './package-manager.mjs';
import { claudeJsonMcpServer, probeVersionCommand } from './stack.mjs';

/** How long a command may run when nobody watches it (D6): a package install downloads, a registration writes one entry. */
export const TIMEOUTS = { package: 120_000, registration: 30_000 };

/** The spawn of the real commands: refused in a test process, before anything runs, as `runSchtasks` is. */
export function realSpawn(file, args, options) {
  if (underTest()) throw new Error('a stack command is never run from a test: this one has to hand in a fake spawn');
  return spawnSync(file, args, options);
}

/** The variables that point a child at the home `home` when it is not the real one (D6): Claude and Codex read their
 * configuration from these, so a scratch home keeps every write out of the real one. `{}` for the real home. */
export function homeEnv(home, realHome, platform) {
  if (path.resolve(home) === path.resolve(realHome)) return {};
  const vars = { HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex') };
  if (platform === 'win32') Object.assign(vars, { APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local') });
  return vars;
}

/** `base` with `delta` over it, where a `PATH` in `delta` goes before the one `base` has (under the key `base` names it
 * by: Windows calls it `Path`) instead of replacing it. */
export function withEnv(base, delta, platform) {
  const { PATH: before, ...rest } = delta ?? {};
  const env = { ...base, ...rest };
  if (before) {
    const key = Object.keys(base).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
    env[key] = base[key] ? `${before}${platform === 'win32' ? ';' : ':'}${base[key]}` : before;
  }
  return env;
}

/** The first word cmd.exe would read inside quotes (`%NAME%`, or a `"` that ends them), or `null`; only on Windows,
 * where every command goes through cmd.exe. `upgradeMain` refuses the same words. */
export function refusedWord(words, platform) {
  if (platform !== 'win32') return null;
  return words.find((word) => /[%"]/.test(word)) ?? null;
}

/** A command as a person reads it, each word quoted where the shell would split or read it. */
export const shownCommand = (words, platform) => words.map((word) => shownWord(word, platform)).join(' ');

/** Runs `words` once, as `{ ok, status, why }`: `why` says what failed (its exit code and the last line it printed,
 * a timeout, the error that kept it from starting, or a refused word), `null` when it exited 0; a timeout also sets
 * `timedOut`, since it kills the shell and not always what the shell started. On Windows it goes
 * as one cmd.exe line, each word through `cmdWord` (a `.cmd` shim starts only through a shell); elsewhere as an argv.
 * In a terminal (`interactive`) the child shares it and is never timed out, since the person watches it; else its stdin
 * is closed, so nothing waits on an answer, and `timeout` applies. */
export function runWords(words, { spawn = realSpawn, env, timeout, interactive = false, platform = process.platform }) {
  const refused = refusedWord(words, platform);
  if (refused !== null) return { ok: false, status: null, why: `refused the word ${refused}: cmd.exe would read it` };
  const options = { encoding: 'utf8', env, timeout: interactive ? undefined : timeout, stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'] };
  const result = platform === 'win32'
    ? spawn(words.map(cmdWord).join(' '), [], { ...options, shell: true })
    : spawn(words[0], words.slice(1), options);
  if (result.error?.code === 'ETIMEDOUT' || (result.status === null && result.signal)) return { ok: false, status: null, why: `timed out after ${timeout} ms`, timedOut: true };
  if (result.error) return { ok: false, status: null, why: result.error.message };
  if (result.status === 0) return { ok: true, status: 0, why: null };
  const last = String(result.stderr || result.stdout || '').trim().split(/\r?\n/).pop();
  return { ok: false, status: result.status, why: last ? `exit ${result.status}: ${last}` : `exit ${result.status}` };
}

/** The `[mcp_servers.<name>]` table of `<home>/.codex/config.toml`, with its own subtables (`[mcp_servers.<name>.env]`),
 * as its text trimmed, or `null` when there is none: what `codex mcp add` wrote, so an undo can tell the entry it made
 * from one written since. */
export function codexMcpSection(home, name) {
  let text;
  try {
    text = fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8');
  } catch {
    return null;
  }
  const lines = text.split(/\r?\n/);
  const own = (line) => line.trim() === `[mcp_servers.${name}]` || line.trim().startsWith(`[mcp_servers.${name}.`);
  const start = lines.findIndex((line) => line.trim() === `[mcp_servers.${name}]`);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !(/^\s*\[/.test(lines[end]) && !own(lines[end]))) end += 1;
  return lines.slice(start, end).join('\n').trim();
}

/** What the undo of `row` applies to now (D7), as `{ present, value }`: for a package, whether its binary answers and
 * the version it gives; for a registration, the entry in Claude's `~/.claude.json` or the table in Codex's config. */
export function appliesOf(row, { home, spawn, platform, env }) {
  if (row.kind === 'package') {
    const { state, version } = probeVersionCommand(row.bin, ['--version'], { spawn, platform, env });
    if (state === 'missing') return { present: false, value: null, readable: true };
    return { present: true, value: version, readable: state === 'ok' };
  }
  if (row.dimension === 'claude') {
    const { state, entry } = claudeJsonMcpServer(home, row.tool);
    return { present: entry != null, value: entry ?? null, readable: state !== 'unknown' };
  }
  const value = codexMcpSection(home, row.tool);
  return { present: value !== null, value, readable: true };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The undo of `record` as a person runs it by hand: its words, and the environment it was given (a prefix's home, a
 * scratch home), a `PATH` as what goes first on it, since without them it reaches the default install. */
function shownUndo(record, platform) {
  const vars = Object.entries(record.env ?? {}).map(([name, value]) => (name === 'PATH' ? `${value} first on the PATH` : `${name}=${value}`));
  const command = shownCommand(record.undo, platform);
  if (vars.length === 0) return command;
  return `${command}, with ${vars.length === 1 ? vars[0] : `${vars.slice(0, -1).join(', ')} and ${vars.at(-1)}`}`;
}

/** Undoes the records of `stack install`, the last run first (D7), as `{ undone, kept, failedRecords }`. Each is
 * probed first: a tool already gone loses its record (`gone`); one whose undo no longer applies (he upgraded it, or
 * registered it again with another entry) is his, kept and named, and loses its record (`changed`); else its undo is
 * printed, then run with the record's environment, and one that fails keeps its record, so a second run can finish
 * it (`failed`). A record whose tool answers but cannot be read (`unreadable`) keeps its record untouched, and so does
 * the Codex CLI while an undo of a registration in Codex failed (`needed`), since that undo needs it. A record whose
 * command never got as far as reading back (`applies` is `null`) cannot tell what it left from a later install of his
 * own, so its undo is named, never run, and its record dropped (`unread`; T7, gentle-ai R1-001); one in Codex keeps
 * the Codex CLI too (`needed`), so that undo can still run. `failedRecords`
 * keeps the order they were installed in. */
export function undoStack(records, { home, spawn = realSpawn, platform = process.platform, env = process.env, log = () => {} }) {
  const undone = [];
  const kept = [];
  const failed = new Set();
  const keep = (record, entry) => {
    kept.push(entry);
    failed.add(record);
  };
  const leftUnread = new Set();
  const inCodex = (set) => [...set].some((other) => other.kind === 'registration' && other.dimension === 'codex');
  for (const record of [...records].reverse()) {
    const key = { tool: record.tool, dimension: record.dimension };
    if (record.kind === 'package' && record.tool === 'codex' && (inCodex(failed) || inCodex(leftUnread))) {
      keep(record, { ...key, reason: 'needed', why: inCodex(failed) ? 'its undo of a registration in Codex failed, and needs it' : 'the undo of a registration in Codex left to you needs it' });
      continue;
    }
    const childEnv = withEnv(env, record.env, platform);
    const now = appliesOf(record, { home, spawn, platform, env: childEnv });
    if (!now.readable) {
      keep(record, { ...key, reason: 'unreadable', why: 'it answers, but its version cannot be read' });
      continue;
    }
    if (!now.present) {
      kept.push({ ...key, reason: 'gone' });
      continue;
    }
    if (record.applies === null) {
      kept.push({ ...key, reason: 'unread', undo: shownUndo(record, platform) });
      leftUnread.add(record);
      continue;
    }
    if (!same(now.value, record.applies)) {
      kept.push({ ...key, reason: 'changed' });
      continue;
    }
    log(`undo ${record.tool} ${record.dimension}: ${shownCommand(record.undo, platform)}`);
    const result = runWords(record.undo, { spawn, env: childEnv, timeout: TIMEOUTS[record.kind], platform });
    if (result.ok) {
      undone.push(key);
    } else {
      keep(record, { ...key, reason: 'failed', why: result.why });
    }
  }
  return { undone, kept, failedRecords: records.filter((record) => failed.has(record)) };
}
