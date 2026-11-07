// The `hook entries` row of `check`: how many hook entries Claude Code runs for a project, by event and by owner,
// and how many js-harness's own `install` writes. Each entry is a process every matching event pays for, so a new
// one is a cost every session of every project carries (odd/tasks/workshop-product-split.md, slice D0, taken from
// F8's S4a). In the harness's own repository the row fails when `install` would write more entries than
// `HOOK_ENTRY_LIMIT`, so a change that adds one is seen at its commit. Anywhere else it only informs: the home's
// settings are shared by every project of the machine, and a hook another tool installed there is no fault of
// the project being committed. A project whose `harness.json` says `"hookCount": true` is held to more, wherever
// its gate runs: every owner × event cell of the live entries to a ceiling, and no owner the table does not name
// (F8's S4a, odd/tasks/f8-s4a-hook-count.md). Read-only: it reads settings files, never runs a hook.
import path from 'node:path';
import { entryComponents } from './manifest.mjs';
import { claudeHookEntries } from './payload.mjs';
import { isHarnessRepository } from './spec.mjs';

/** The entries `install` writes today (15, measured in a scratch home on 2026-11-04). A cut that removes one lowers
 * this in its own pull request; a change that adds one raises it there, where its review sees why. */
export const HOOK_ENTRY_LIMIT = 15;

/** The ceilings of the hook count, `owner -> event -> entries`, counted on this machine on 2026-11-06 (the S4a
 * document's L3): codegraph's prompt hook and the hooks of the two plugins the stack installs. js-harness is not here:
 * its ceiling for an event is what `install` writes for it (`installEntries`). A ceiling only goes down: a cell that
 * reaches 0 leaves the table. An owner that is not here is a new owner, whatever its count. */
export const HOOK_CEILINGS = Object.freeze({
  codegraph: Object.freeze({ UserPromptSubmit: 1 }),
  'engram@engram': Object.freeze({ PreToolUse: 1, SessionStart: 3, UserPromptSubmit: 1, SubagentStop: 1, SessionEnd: 1 }),
  'codex@openai-codex': Object.freeze({ SessionStart: 1, SessionEnd: 1, Stop: 1 }),
});

/** The command that takes a cell's extra entry out, where js-harness has one: `owner event -> command`. D8's hook comes
 * back with each engram plugin update. */
const CELL_FIXES = Object.freeze({ 'engram@engram UserPromptSubmit': 'js-harness stack engram-prompt off' });

// The owners of a hook the harness installs or sets up: its own entries and codegraph's prompt hook, which
// `stack` installs. An enabled plugin is known too, by its id. Any other owner is warned of, never failed, unless
// the project turns the count on.
const KNOWN_OWNERS = ['js-harness', 'codegraph'];

// Programs that run a script or a package: the owner is what they run, not the program.
const RUNNERS = ['node', 'npm', 'npx', 'pnpm'];
// The package managers' words that name no package: what follows them does.
const SUBCOMMANDS = ['run', 'run-script', 'exec', 'dlx', 'x'];
const SCRIPT = /\.(mjs|cjs|js|mts|ts)$/i;
const EXTENSION = /\.(cmd|exe|bat|ps1|sh|mjs|cjs|js|mts|ts)$/i;

/** Whether `target` is Claude Code's own settings file, `<home>/.claude/settings.json`. */
function claudeSettings(target) {
  const file = target('home');
  return path.basename(file) === 'settings.json' && path.basename(path.dirname(file)) === '.claude';
}

/** The hook entries `install` writes into Claude Code's settings, `{ event, command }` each, read from the
 * manifest's entry components so the count is the one `install` acts on. An entry another host's file holds under
 * the same pointer is not counted. */
export function installEntries(components = entryComponents) {
  return components
    .filter((component) => component.pointer[0] === 'hooks' && claudeSettings(component.target))
    .flatMap((component) => component.entry().hooks.map((hook) => ({ event: component.pointer[1], command: hook.command })));
}

/** The command hook entries Claude Code runs for the project at `cwd`, from the home's and the project's settings and
 * the `hooks/hooks.json` of the enabled plugins (./payload.mjs). Not read: prompt and agent hooks, which have no
 * command, hooks a plugin declares in its `plugin.json`, and managed settings. */
export function liveEntries(home, cwd) {
  return claudeHookEntries(home, cwd);
}

/** The owner of an entry: its plugin's id, else the name of the program its command starts, without folder or
 * extension (`codegraph.cmd` is `codegraph`). For a runner, what it runs: a relative script's top folder
 * (`node workshop/x.mjs` is `workshop`), an absolute script's own name, a package's name. '(empty)' for no command. */
export function ownerOf({ command, plugin }) {
  if (plugin) return plugin;
  const words = (command.trim().match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((word) => word.replace(/^(["'])(.*)\1$/, '$2'));
  if (words.length === 0) return '(empty)';
  const name = (file) => file.split(/[\\/]/).pop().replace(EXTENSION, '');
  const program = name(words[0]);
  const runner = program.toLowerCase();
  if (!RUNNERS.includes(runner)) return program;
  const rest = words.slice(1);
  // node takes flags with values before its script, so its script is the first word that is one.
  const target = runner === 'node' ? rest.find((word) => SCRIPT.test(word)) : rest.find((word) => !word.startsWith('-') && !SUBCOMMANDS.includes(word));
  if (!target) return program;
  if (/^([a-z]:)?[\\/]/i.test(target)) return name(target);
  const parts = target.replace(/^\.[\\/]/, '').split(/[\\/]/);
  return parts.length > 1 ? parts[0] : name(target);
}

/** `{ owner: count }`, in the order owners are first met. */
function countBy(entries, key) {
  const counts = new Map();
  for (const entry of entries) counts.set(key(entry), (counts.get(key(entry)) ?? 0) + 1);
  return counts;
}

/** The ceilings of `owner`, `event -> entries`: for js-harness, what `installed` writes for each event; for any
 * other, its row of `HOOK_CEILINGS`, or `undefined` for an owner the table does not name. */
function ceilingsOf(owner, installed) {
  return owner === 'js-harness' ? Object.fromEntries(countBy(installed, (entry) => entry.event)) : HOOK_CEILINGS[owner];
}

/** The `hook entries` row. `deps.own` says whether `cwd` is the harness's own repository (by default
 * `isHarnessRepository`); `deps.declared` is the project's `harness.json`, whose `"hookCount": true` holds the live
 * entries to the ceilings; `deps.installed` and `deps.live` replace what is read, for the tests. */
export function hookEntriesRow(cwd, home, deps = {}) {
  const own = deps.own ?? isHarnessRepository(cwd);
  const live = deps.live ?? liveEntries(home, cwd);
  const counting = Boolean(deps.declared) && 'hookCount' in deps.declared;
  const held = counting && deps.declared.hookCount === true;
  const installed = own || held ? (deps.installed ?? installEntries()) : [];
  const byOwner = countBy(live, ownerOf);
  const plural = (n) => (n === 1 ? 'entry' : 'entries');
  const owners = [...byOwner].map(([owner, n]) => `${owner} ${n}`).join(', ');
  const detail = `${live.length} ${plural(live.length)} in this home and project${owners ? `: ${owners}` : ''}`;

  const lines = [];
  // Where the count holds, a cell over its ceiling and an owner the table does not name fail the row, one line each.
  const problems = [];
  for (const [owner, n] of byOwner) {
    const events = [...countBy(live.filter((entry) => ownerOf(entry) === owner), (entry) => entry.event)];
    const ceilings = held ? ceilingsOf(owner, installed) : undefined;
    if (held && !ceilings) {
      problems.push(`${owner}: a new owner, not in the table: ${events.map(([event, count]) => `${event} ${count}`).join(', ')}`);
      continue;
    }
    lines.push(`${owner}: ${events.map(([event, count]) => `${event} ${count}${ceilings ? `/${ceilings[event] ?? 0}` : ''}`).join(', ')}`);
    for (const [event, count] of ceilings ? events : []) {
      if (count > (ceilings[event] ?? 0)) problems.push(`${owner} ${event}: ${count} ${plural(count)}, over its ceiling of ${ceilings[event] ?? 0}${CELL_FIXES[`${owner} ${event}`] ? `; ${CELL_FIXES[`${owner} ${event}`]} takes it out` : ''}`);
    }
    const known = KNOWN_OWNERS.includes(owner) || live.some((entry) => entry.plugin === owner);
    if (!known && !held) lines.push(`warning: ${n} ${plural(n)} owned by "${owner}", which neither js-harness, its stack nor an enabled plugin installs`);
  }
  const ours = byOwner.get('js-harness') ?? 0;
  if (ours > HOOK_ENTRY_LIMIT) {
    lines.push(`warning: js-harness has ${ours} entries in this home and project, over the limit of ${HOOK_ENTRY_LIMIT}, which is what this copy writes: an install of another version, or an entry added by hand (js-harness sync writes them again)`);
  }

  if (counting && !held) {
    return { name: 'hook entries', pass: false, info: false, detail, lines: [`harness.json "hookCount" must be true; it is ${JSON.stringify(deps.declared.hookCount)}`, ...lines] };
  }
  if (!own && !held) return { name: 'hook entries', pass: true, info: true, detail, lines };
  const over = own && installed.length > HOOK_ENTRY_LIMIT;
  if (own) lines.unshift(`install writes ${installed.length} ${plural(installed.length)} (limit ${HOOK_ENTRY_LIMIT})${over ? ': one more process on every matching event of every session; lower the count, or raise HOOK_ENTRY_LIMIT in bin/lib/hook-count.mjs with why' : ''}`);
  if (problems.length === 0) return { name: 'hook entries', pass: !over, info: false, detail, lines };
  const fix = 'take the entry out, or raise its ceiling in HOOK_CEILINGS (bin/lib/hook-count.mjs) in a commit that says why; the ceilings of js-harness are what install writes, which js-harness sync writes again';
  return { name: 'hook entries', pass: false, info: false, detail: `${detail}; ${problems.length} over the table`, lines: [...problems, ...lines, fix] };
}
