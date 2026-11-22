// What the host recorded of each hook it ran in the newest sessions, for `doctor`'s `hooks` row: C3.4 of
// odd/tasks/f8-s8-certification.md (T2), "registered hooks not cancelled or timed out, last 20 sessions", line 100%
// (docs/proposals/harness-diet.md:536). `hook-count.mjs` counts the entries configured; this reads what ran.
//
// Claude Code writes one attachment per hook it ends: `hook_success`, `hook_blocking_error`,
// `hook_non_blocking_error` or `hook_cancelled`, the last with `timedOut: true` and the hook's command when its timeout
// ended it. A cancel with no command stands for every hook of its event at once: read on 2026-11-22 in session
// d6383aea, 627 PostToolUse tool uses held that one attachment and nothing else. So an invocation is a tool use (its
// `toolUseID`, a uuid for an event that has no tool) and an event, and it misses when any of its attachments is a
// cancel. `hook_additional_context`, `hook_system_message` and `hook_permission_decision` come beside an end, never
// instead of one, and are not counted. A forked session copies its parent's lines with their uuids, so a line already
// counted in a newer session is passed over. It reads and writes nothing else.
import fs from 'node:fs';
import path from 'node:path';

/** How many sessions the measure reads, newest first: C3.4's "last 20 sessions". */
export const HOOK_SESSIONS = 20;

/** The attachments that end a hook. */
const ENDS = new Set(['hook_success', 'hook_blocking_error', 'hook_non_blocking_error', 'hook_cancelled']);

/** The hooks a transcript's `text` records, as `{ invocations, events, cancelled, timedOut, truncated }`:
 * `cancelled` and `timedOut` count invocations, an invocation with a timeout counted as timed out. `truncated` when a
 * line that names a hook does not parse or the text does not end with a line break, since then a hook's end may be
 * lost. `seen` holds the uuids already counted, and gets this text's. */
export function readTranscriptHooks(text, seen) {
  const invocations = new Map();
  let events = 0;
  let truncated = text !== '' && !text.endsWith('\n');
  for (const line of text.split('\n')) {
    if (!line.includes('"hook_')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      truncated = true;
      continue;
    }
    const hook = entry?.attachment;
    if (entry?.type !== 'attachment' || !ENDS.has(hook?.type)) continue;
    if (entry.uuid) {
      if (seen.has(entry.uuid)) continue;
      seen.add(entry.uuid);
    }
    events += 1;
    const key = `${hook.toolUseID ?? entry.uuid}\u0000${hook.hookEvent}`;
    const state = invocations.get(key) ?? 'ok';
    if (hook.type !== 'hook_cancelled') invocations.set(key, state);
    else invocations.set(key, hook.timedOut === true || state === 'timedOut' ? 'timedOut' : 'cancelled');
  }
  const states = [...invocations.values()];
  return {
    invocations: states.length,
    events,
    cancelled: states.filter((state) => state === 'cancelled').length,
    timedOut: states.filter((state) => state === 'timedOut').length,
    truncated,
  };
}

/** The top-level transcripts of every project under `<claudeDir>/projects`, newest first: `{ id, project, file, ms }`.
 * A sub-agent's transcript sits in its session's folder and is not one. Throws when the folder cannot be read. */
function transcripts(claudeDir) {
  const root = path.join(claudeDir, 'projects');
  const found = [];
  for (const project of fs.readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    let names;
    try {
      names = fs.readdirSync(path.join(root, project.name));
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      const file = path.join(root, project.name, name);
      try {
        found.push({ id: name.slice(0, -'.jsonl'.length), project: project.name, file, ms: fs.statSync(file).mtimeMs });
      } catch {
        // gone between the listing and the look
      }
    }
  }
  return found.sort((a, b) => b.ms - a.ms);
}

/** The hooks of the `limit` newest sessions under `claudeDir` (`~/.claude`): each session `{ id, project, at,
 * invocations, events, cancelled, timedOut, truncated }`, newest first, `at` its last write; the totals; `truncated`,
 * the ids of the traces that may have lost a hook's end, one that cannot be read among them; `short`, how many sessions short of `limit` it read. Newest
 * first, so a fork's copy of its parent's lines counts in the fork. Throws when there is no projects folder. */
export function hookHealth({ claudeDir, limit = HOOK_SESSIONS }) {
  const seen = new Set();
  const sessions = [];
  for (const transcript of transcripts(claudeDir)) {
    if (sessions.length === limit) break;
    let text;
    try {
      text = fs.readFileSync(transcript.file, 'utf8');
    } catch {
      // One of the newest that cannot be read is no clean session: it stays in its place, its ends lost.
      sessions.push({ id: transcript.id, project: transcript.project, at: new Date(transcript.ms).toISOString(), invocations: 0, events: 0, cancelled: 0, timedOut: 0, truncated: true });
      continue;
    }
    sessions.push({ id: transcript.id, project: transcript.project, at: new Date(transcript.ms).toISOString(), ...readTranscriptHooks(text, seen) });
  }
  const sum = (field) => sessions.reduce((total, session) => total + session[field], 0);
  return {
    sessions,
    invocations: sum('invocations'),
    cancelled: sum('cancelled'),
    timedOut: sum('timedOut'),
    truncated: sessions.filter((session) => session.truncated).map((session) => session.id),
    short: limit - sessions.length,
  };
}
