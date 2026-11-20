// `js-harness stack can-close` (odd/tasks/closed-app-update.md, S4): whether Claude Desktop can be closed now, for an
// update or a restart, and why not. The session list alone cannot tell: on 2026-11-20 `claude agents` listed two
// sessions idle while a shell ran under each (the feature's Depth pass, item 4), and twice that day "you can close"
// was said from the list. So this reads four things and says yes only when all four were read and none runs:
//   - the sessions `claude agents --json --all` lists at work (`atWork`), the caller's own session left out;
//   - a shell that is a direct child of a session's claude.exe: a tool call, foreground or background (MCP servers
//     sit under cmd.exe, engram is engram.exe); the caller's own call is left out by its ancestry;
//   - the machine's gate lock, held by a gate;
//   - staged work not committed in a worktree of the project.
// Read-only: it spawns `claude agents`, one process snapshot and `git worktree list` / `git diff --cached --quiet`.
// A part that could not be read makes the answer "cannot tell", never yes.
import { spawnSync } from 'node:child_process';
import { atWork } from './background.mjs';

/** The names of the processes that run a tool call when they are a direct child of a session's claude.exe. */
const SHELLS = new Set(['bash.exe', 'sh.exe', 'powershell.exe', 'pwsh.exe', 'bash', 'sh', 'zsh', 'pwsh']);
const isClaude = (p) => /^claude(\.exe)?$/i.test(p?.name ?? '');

/** The pids from `pid` up through its ancestors, as the snapshot knows them. */
function ancestry(byPid, pid) {
  const chain = new Set();
  for (let p = byPid.get(pid); p && !chain.has(p.pid); p = byPid.get(p.ppid)) chain.add(p.pid);
  return chain;
}

/** Each shell that is a direct child of a claude.exe whose own parent is a claude.exe too (a session under the app),
 * or that `agents` lists by pid, as `{ pid, name, since, session }`; the shell the caller runs in is left out. */
export function shellsUnderSessions(snapshot, { agents = [], ownPid = process.pid } = {}) {
  const byPid = new Map(snapshot.map((p) => [p.pid, p]));
  const own = ancestry(byPid, ownPid);
  const named = new Map((Array.isArray(agents) ? agents : []).filter((a) => Number.isInteger(a.pid)).map((a) => [a.pid, a.name]));
  return snapshot
    .filter((p) => SHELLS.has(String(p.name).toLowerCase()) && !own.has(p.pid))
    .filter((p) => {
      const parent = byPid.get(p.ppid);
      return isClaude(parent) && (isClaude(byPid.get(parent.ppid)) || named.has(parent.pid));
    })
    .map((p) => ({ pid: p.pid, name: p.name, since: p.createdAt, session: named.get(p.ppid) ?? `claude.exe pid ${p.ppid}` }));
}

const clock = (ms) => (Number.isFinite(ms) ? `${new Date(ms).toISOString().slice(11, 19)}Z` : 'an unknown time');

/** The verdict from the four reads, each a value or the `Error` its read threw: `{ canClose, reasons, unread }`,
 * `canClose` `true`, `false`, or `null` when a part could not be read and nothing else said no. */
export function closeVerdict({ agents, shells, gate, staged, selfSessionId = null }) {
  const reasons = [];
  const unread = [];
  const part = (value, what) => {
    if (value instanceof Error) {
      unread.push(`${what}: ${value.message}`);
      return null;
    }
    return value;
  };
  for (const agent of part(agents, 'the sessions (claude agents)') ?? []) {
    if (!atWork(agent) || (selfSessionId && agent.sessionId === selfSessionId)) continue;
    reasons.push(`${agent.name ?? agent.id ?? 'a session'} is at work (${agent.status ?? agent.state})`);
  }
  for (const shell of part(shells, 'the processes (snapshot)') ?? []) {
    reasons.push(`${shell.session} runs a shell (${shell.name}, pid ${shell.pid}) since ${clock(shell.since)}: a tool call or a background task`);
  }
  const holder = part(gate, "the machine's gate lock");
  if (holder) reasons.push(`a gate holds the machine's lock (pid ${holder.pid ?? 'unknown'}, ${holder.cwd ?? 'folder unknown'})`);
  for (const tree of part(staged, 'the staged work') ?? []) reasons.push(`work is staged and not committed in ${tree}`);
  const canClose = reasons.length > 0 ? false : unread.length > 0 ? null : true;
  return { canClose, reasons, unread };
}

/** The verdict as the lines a person reads: yes, no or cannot tell first, then each reason and each part not read. */
export function renderVerdict({ canClose, reasons, unread }) {
  const head = canClose === true
    ? 'yes: no session works, no background task or gate runs and no work is staged; Claude Desktop can close now'
    : canClose === false
      ? `no: ${reasons.length} thing${reasons.length === 1 ? ' runs' : 's run'}; close Claude Desktop once ${reasons.length === 1 ? 'it ends' : 'they end'}`
      : 'cannot tell: a part could not be read, so this is no yes';
  return [head, ...reasons.map((r) => `  - ${r}`), ...unread.map((u) => `  - not read: ${u}`)];
}

/** The worktrees of the repository at `cwd` that hold staged changes. Throws when the list cannot be read; a
 * worktree whose diff cannot be read (a stale entry) is skipped, since git lists it as prunable. */
export function stagedWorktrees(cwd, run = spawnSync) {
  const list = run('git', ['-C', cwd, 'worktree', 'list', '--porcelain'], { encoding: 'utf8', windowsHide: true });
  if (list.error || list.status !== 0) throw new Error(`git worktree list: ${list.error?.message ?? String(list.stderr ?? '').trim() ?? `exit ${list.status}`}`);
  const trees = String(list.stdout).split(/\r?\n\r?\n/).map((block) => ({
    path: /^worktree (.+)$/m.exec(block)?.[1],
    prunable: /^prunable/m.test(block),
  })).filter((t) => t.path && !t.prunable);
  return trees.filter((t) => run('git', ['-C', t.path, 'diff', '--cached', '--quiet'], { encoding: 'utf8', windowsHide: true }).status === 1).map((t) => t.path);
}

/** Runs the four reads through their seams and returns the verdict; a read that throws is an unread part. */
export async function readCanClose({ cwd, home, listAgents, snapshot, gateHolder, staged, ownPid = process.pid, selfSessionId = null }) {
  const attempt = async (read) => {
    try {
      return await read();
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  };
  const agents = await attempt(listAgents);
  const processes = await attempt(snapshot);
  const shells = processes instanceof Error ? processes : shellsUnderSessions(processes, { agents: agents instanceof Error ? [] : agents, ownPid });
  const gate = await attempt(() => gateHolder(home));
  const worktrees = await attempt(() => staged(cwd));
  return closeVerdict({ agents, shells, gate, staged: worktrees, selfSessionId });
}
