// `js-harness permit`: the relay of permission cards to the orchestrator (odd/tasks/held-sessions.md, S8).
//
// The host asks the user before some tool calls even in bypass mode, and a session that meets such a card waits until
// the user answers it in that session's window: on 2026-10-17 five sessions waited 12 to 38 hours. The user wants the
// orchestrator to read what each card asks and let it proceed when it is safe. The host gives a session no tool to
// answer another's card; its `PermissionRequest` hook is the one way, so `permit --hook` is that hook:
//   - With no lead holding the relay (`permit lease`), or for the lead's own card, it answers nothing at once: the card
//     reaches the user as it always did.
//   - Otherwise it records the request under the channel folder, tells the orchestrator by a notice, and waits up to
//     `WAIT_MS` for the lead's verdict (`permit allow <id>`, `permit deny <id> --reason <text>`). An allow or a deny is
//     answered to the host; with no verdict in time it answers nothing and the card reaches the user.
// Nothing is ever allowed by a rule: only by the lead's explicit verdict. Every outcome is logged in `log.jsonl`.
// The files live under the channel folder, so `uninstall` removes them with it.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unknownArgument } from './lib/args.mjs';
import { appendNotice, channelDir, newNotice } from './lib/channel.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
import { LEASE_MINUTES, WAIT_MS } from './lib/permit-times.mjs';

export { LEASE_MINUTES, WAIT_MS };

export const USAGE = 'Usage: js-harness permit --hook | lease [--session <id>] [--minutes <n>] [--take-over] | lease --off | list [--json]\n'
  + '       | allow <id> | deny <id> --reason <text>\n'
  + '  Every flag is checked: a token a subcommand does not take, or a value flag with no value, is refused with exit 2\n'
  + '  before anything is written.\n'
  + '  --hook   the PermissionRequest hook install registers: while a lead holds the relay, a card of another session\n'
  + '           is told to the orchestrator and waits up to 9.5 minutes for its verdict; with none it reaches the user\n'
  + '  lease    the lead holds the relay for --minutes (default 40) as --session, or as the running session; --off ends it;\n'
  + '           a lease another session holds is replaced or ended only with --take-over\n'
  + '  list     the requests waiting for a verdict, with their session, tool and command\n'
  + '  allow    lets the request proceed; deny refuses it, and the reason is shown to the session; only the session\n'
  + '           holding the relay gives a verdict, never the one that asks\n';

const SCHEMA = 'js-harness.permit/v1';
const POLL_MS = 2000;

/** The folder of the project `slug`'s relay under `home`: under the channel folder, which `uninstall` removes. */
export function permitsDir(home, slug) {
  return path.join(channelDir(home), 'permits', slug);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, value, flag = 'w') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, { encoding: 'utf8', flag });
}

function logOutcome(dir, at, id, outcome, reason = null) {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'log.jsonl'), `${JSON.stringify({ at, id, outcome, ...(reason === null ? {} : { reason }) })}\n`, 'utf8');
}

function loggedIds(dir) {
  try {
    return new Set(fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
      try {
        return JSON.parse(line).id;
      } catch {
        return null;
      }
    }));
  } catch {
    return new Set();
  }
}

/** What a request asks, on one line: a Bash call's command, else its input as JSON. */
function askedOf(tool, input) {
  const text = tool === 'Bash' && typeof input?.command === 'string' ? input.command : JSON.stringify(input ?? {});
  return text.replace(/\s+/g, ' ').trim();
}

const short = (id) => String(id ?? 'unknown').slice(0, 8);

/** The lease of `dir` when a lead holds it at `now`, else null. */
function heldLease(dir, now) {
  const lease = readJson(path.join(dir, 'lease.json'));
  return lease !== null && typeof lease.session === 'string' && Date.parse(lease.until) > now.getTime() ? lease : null;
}

/** Whether the wait of `item` has ended at `now`; a request whose time cannot be read has ended. */
const waitEnded = (item, now) => !(Date.parse(item.at) + WAIT_MS > now.getTime());

/** The requests of `dir` still waiting at `now`: no verdict, no logged outcome, and their wait not ended. */
function pendingOf(dir, now) {
  let names;
  try {
    names = fs.readdirSync(path.join(dir, 'requests'));
  } catch {
    return [];
  }
  const ended = loggedIds(dir);
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(dir, 'requests', name)))
    .filter((item) => item !== null && !ended.has(item.id) && !fs.existsSync(path.join(dir, 'verdicts', `${item.id}.json`))
      && !waitEnded(item, now))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

const decision = (value) => `${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: value } })}\n`;

async function hook(deps) {
  const payload = JSON.parse(deps.readStdin());
  if (payload?.hook_event_name !== undefined && payload.hook_event_name !== 'PermissionRequest') return;
  // The wait counts from here, before the git lookup, so the hook answers well inside the host's timeout.
  const start = deps.now();
  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : deps.cwd;
  const slug = projectSlug(deps.projectRoot(cwd));
  const dir = permitsDir(deps.home, slug);
  const lease = heldLease(dir, start);
  if (lease === null || payload.session_id === lease.session) return;
  const id = `p${start.getTime().toString(36)}${randomBytes(2).toString('hex')}`;
  const at = start.toISOString();
  const tool = String(payload.tool_name ?? 'unknown');
  writeJson(path.join(dir, 'requests', `${id}.json`), {
    schema: SCHEMA, id, at, session: payload.session_id ?? null, transcript: payload.transcript_path ?? null, cwd,
    mode: payload.permission_mode ?? null, tool, input: payload.tool_input ?? null,
  }, 'wx');
  const head = `permit ${id}: ${short(payload.session_id)} asks ${tool}: `;
  const asked = askedOf(tool, payload.tool_input);
  const room = 500 - head.length;
  const text = head + (asked.length > room ? `${asked.slice(0, room - 1)}…` : asked);
  const from = { host: 'claude-code', id: payload.session_id ?? null, source: 'hook', title: null, permissionMode: payload.permission_mode ?? null, context: null };
  appendNotice(deps.home, slug, newNotice({ at, from, to: 'orchestrator', kind: 'note', text, cwd }));
  const deadline = start.getTime() + WAIT_MS;
  for (;;) {
    const verdict = readJson(path.join(dir, 'verdicts', `${id}.json`));
    if (verdict !== null && (verdict.behavior === 'allow' || verdict.behavior === 'deny')) {
      logOutcome(dir, deps.now().toISOString(), id, verdict.behavior, verdict.reason ?? null);
      if (verdict.behavior === 'allow') deps.stdout(decision({ behavior: 'allow' }));
      else deps.stdout(decision({ behavior: 'deny', message: `js-harness permit: the orchestrator denied this: ${verdict.reason ?? 'no reason given'}` }));
      return;
    }
    if (deps.now().getTime() >= deadline) {
      logOutcome(dir, deps.now().toISOString(), id, 'timeout');
      return;
    }
    await deps.sleep(POLL_MS);
  }
}

/** A usage error of one subcommand's arguments: its message says which token, and the usage follows, exit 2. */
class PermitArgError extends Error {}

/** Refuses a value flag of `known` given with no value, then the first token of `args` that the flags `known` do not
 * name (bin/lib/args.mjs), so `--session --bogus` names the missing value, as `update` does. */
function refuseUnknown(args, known) {
  for (const flag of known.valued ?? []) valueOf(args, flag);
  const unknown = unknownArgument(args, known);
  if (unknown !== null) throw new PermitArgError(`unknown argument: ${unknown}`);
}

/** The value of `flag`, or undefined when it is not given. A value is never a flag: a missing one, or a flag, is refused. */
function valueOf(args, flag) {
  const at = args.indexOf(flag);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) throw new PermitArgError(`${flag} requires a value`);
  return value;
}

/** The arguments of `lease`: `--off` ends the lease and takes no other flag; otherwise `--session`, `--minutes`, `--take-over`. */
function leaseArgs(args) {
  if (args.includes('--off')) {
    refuseUnknown(args, { bare: ['--off', '--take-over'] });
    return { off: true, takeOver: args.includes('--take-over') };
  }
  refuseUnknown(args, { valued: ['--session', '--minutes'], bare: ['--take-over'] });
  return { off: false, session: valueOf(args, '--session'), minutes: valueOf(args, '--minutes'), takeOver: args.includes('--take-over') };
}

/** The arguments of `list`: `--json` and nothing else. */
function listArgs(args) {
  refuseUnknown(args, { bare: ['--json'] });
  return { json: args.includes('--json') };
}

/** The arguments of `allow <id>` and `deny <id> --reason <text>`: one id, and for a denial its reason. */
function verdictArgs(behavior, args) {
  const valued = behavior === 'deny' ? ['--reason'] : [];
  refuseUnknown(args, { valued, positional: true });
  const words = args.filter((token, i) => !token.startsWith('-') && !(i > 0 && valued.includes(args[i - 1])));
  if (words.length > 1) throw new PermitArgError(`unknown argument: ${words[1]}`);
  return { id: words[0], reason: valueOf(args, '--reason') };
}

/**
 * Renews the lease that `session` holds for the project of `cwd`, for `wait` (odd/tasks/harness-review.md, T3): the
 * lease moves to now plus the longer of LEASE_MINUTES and the wait's interval plus 5 minutes. It changes nothing
 * unless `session` holds the lease at `now`: another session's, an expired one, none, or no session id. Returns
 * `{ renewed, until }`; a failure to write throws.
 */
export function renewOwnLease({ home, cwd, session, now, everySeconds, projectRoot = gitProjectRoot }) {
  if (typeof session !== 'string' || session === '') return { renewed: false };
  const dir = permitsDir(home, projectSlug(projectRoot(cwd)));
  const held = heldLease(dir, now);
  if (held === null || held.session !== session) return { renewed: false };
  const minutes = Math.max(LEASE_MINUTES, everySeconds / 60 + 5);
  const until = new Date(now.getTime() + minutes * 60 * 1000).toISOString();
  writeJson(path.join(dir, 'lease.json'), { schema: SCHEMA, session, until });
  return { renewed: true, until };
}

function lease(options, deps, dir) {
  // A lease another session holds is not replaced or ended by mistake: only with --take-over, as a new lead would.
  const held = heldLease(dir, deps.now());
  const caller = deps.env.CLAUDE_CODE_SESSION_ID;
  const takeOver = options.takeOver;
  const refuse = () => {
    deps.stderr(`js-harness permit: ${short(held.session)} holds the relay until ${held.until}; a lead taking it over passes --take-over\n`);
    return 1;
  };
  if (options.off) {
    if (held !== null && held.session !== caller && !takeOver) return refuse();
    fs.rmSync(path.join(dir, 'lease.json'), { force: true });
    deps.stdout('js-harness permit: the relay is off: cards reach the user\n');
    return 0;
  }
  const session = options.session ?? deps.env.CLAUDE_CODE_SESSION_ID;
  const minutes = Number(options.minutes ?? LEASE_MINUTES);
  if (typeof session !== 'string' || session === '' || !(minutes > 0)) {
    deps.stderr(`js-harness permit: lease needs the lead's session: --session <id>, or run it from that session\n${USAGE}`);
    return 2;
  }
  if (held !== null && held.session !== session && !takeOver) return refuse();
  const until = new Date(deps.now().getTime() + minutes * 60 * 1000).toISOString();
  writeJson(path.join(dir, 'lease.json'), { schema: SCHEMA, session, until });
  deps.stdout(`js-harness permit: ${short(session)} holds the relay until ${until}\n`);
  return 0;
}

function list(options, deps, dir) {
  const now = deps.now();
  const held = heldLease(dir, now);
  const pending = pendingOf(dir, now);
  if (options.json) {
    deps.stdout(`${JSON.stringify({ lease: held, pending: pending.map((item) => ({ ...item, waitsUntil: new Date(Date.parse(item.at) + WAIT_MS).toISOString() })) })}\n`);
    return 0;
  }
  deps.stdout(held === null ? 'The relay is off: no lead holds it, so cards reach the user.\n' : `The relay is held by ${short(held.session)} until ${held.until}.\n`);
  if (pending.length === 0) deps.stdout('No request waits for a verdict.\n');
  for (const item of pending) {
    const left = Math.max(0, Math.round((Date.parse(item.at) + WAIT_MS - now.getTime()) / 1000));
    deps.stdout(`${item.id}  ${left}s left  ${short(item.session)}  ${item.tool}  ${askedOf(item.tool, item.input)}\n  cwd ${item.cwd}\n`);
  }
  return 0;
}

function verdict(behavior, options, deps, dir) {
  const { id, reason } = options;
  if (typeof id !== 'string' || (behavior === 'deny' && (typeof reason !== 'string' || reason.trim() === ''))) {
    deps.stderr(`js-harness permit: ${behavior} <id>${behavior === 'deny' ? ' --reason <text>: a denial says why, and the session reads it' : ''}\n${USAGE}`);
    return 2;
  }
  // Only the lead's verdict lets a card through: not another session's, and never the asking session's own.
  const held = heldLease(dir, deps.now());
  const caller = deps.env.CLAUDE_CODE_SESSION_ID;
  if (held === null || typeof caller !== 'string' || caller !== held.session) {
    deps.stderr('js-harness permit: only the session holding the relay gives a verdict; this one does not hold it\n');
    return 1;
  }
  const item = readJson(path.join(dir, 'requests', `${id}.json`));
  if (item !== null && item.session === caller) {
    deps.stderr('js-harness permit: only the session holding the relay gives a verdict, and never on its own request\n');
    return 1;
  }
  if (item === null) {
    deps.stderr(`js-harness permit: no request ${id}; js-harness permit list shows the waiting ones\n`);
    return 1;
  }
  if (loggedIds(dir).has(id) || waitEnded(item, deps.now())) {
    deps.stderr(`js-harness permit: ${id}: its wait ended, and the card went to the user\n`);
    return 1;
  }
  try {
    writeJson(path.join(dir, 'verdicts', `${id}.json`), { schema: SCHEMA, id, behavior, ...(reason === undefined ? {} : { reason: reason.trim() }), at: deps.now().toISOString() }, 'wx');
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    deps.stderr(`js-harness permit: ${id} already has a verdict\n`);
    return 1;
  }
  deps.stdout(`js-harness permit: ${id} ${behavior === 'allow' ? 'allowed' : 'denied'}\n`);
  return 0;
}

function gitProjectRoot(cwd) {
  const run = (file, args, options) => spawnSync(file, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 5000 });
  return mainCheckout(run, cwd);
}

export async function permitMain(argv, {
  env = process.env,
  home = harnessHome({ env, homedir: os.homedir }),
  cwd = process.cwd(),
  projectRoot = gitProjectRoot,
  readStdin = () => fs.readFileSync(0, 'utf8'),
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
  now = () => new Date(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const deps = { env, home, cwd, projectRoot, readStdin, stdout, stderr, now, sleep };
  const [command, ...args] = argv;
  // Each subcommand's arguments are walked before anything runs or is written: a token it does not take is a usage error.
  const walk = {
    '--hook': () => refuseUnknown(args, {}),
    lease: () => leaseArgs(args),
    list: () => listArgs(args),
    allow: () => verdictArgs('allow', args),
    deny: () => verdictArgs('deny', args),
  };
  if (!Object.hasOwn(walk, command)) {
    stderr(USAGE);
    return 2;
  }
  let options;
  try {
    options = walk[command]();
  } catch (err) {
    if (!(err instanceof PermitArgError)) throw err;
    stderr(`js-harness permit: ${err.message}\n${USAGE}`);
    return 2;
  }
  if (command === '--hook') {
    // A hook never fails the host: whatever goes wrong, the card reaches the user as it always did.
    try {
      await hook(deps);
    } catch {
      // nothing answered
    }
    return 0;
  }
  const dir = () => permitsDir(home, projectSlug(projectRoot(cwd)));
  if (command === 'lease') return lease(options, deps, dir());
  if (command === 'list') return list(options, deps, dir());
  return verdict(command, options, deps, dir());
}
