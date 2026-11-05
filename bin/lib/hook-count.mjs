// The `hook entries` row of `check`: how many hook entries Claude Code runs for a project, by event and by owner,
// and how many js-harness's own `install` writes. Each entry is a process every matching event pays for, so a new
// one is a cost every session of every project carries (odd/tasks/workshop-product-split.md, slice D0, taken from
// F8's S4a). In the harness's own repository the row fails when `install` would write more entries than
// `HOOK_ENTRY_LIMIT`, so a change that adds one is seen at its commit. Anywhere else it only informs: the home's
// settings are shared by every project of the machine, and a hook another tool installed there is no fault of
// the project being committed. Read-only: it reads settings files, never runs a hook.
import path from 'node:path';
import { entryComponents } from './manifest.mjs';
import { claudeHookEntries } from './payload.mjs';
import { isHarnessRepository } from './spec.mjs';

/** The entries `install` writes today (15, measured in a scratch home on 2026-11-04). A cut that removes one lowers
 * this in its own pull request; a change that adds one raises it there, where its review sees why. */
export const HOOK_ENTRY_LIMIT = 15;

// The owners of a hook the harness installs or sets up: its own entries and codegraph's prompt hook, which
// `stack` installs. An enabled plugin is known too, by its id. Any other owner is warned of, never failed.
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
  const words = (command.trim().match(/"[^"]*"|\S+/g) ?? []).map((word) => word.replace(/^"|"$/g, ''));
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

/** The `hook entries` row. `deps.own` says whether `cwd` is the harness's own repository (by default
 * `isHarnessRepository`); `deps.installed` and `deps.live` replace what is read, for the tests. */
export function hookEntriesRow(cwd, home, deps = {}) {
  const own = deps.own ?? isHarnessRepository(cwd);
  const live = deps.live ?? liveEntries(home, cwd);
  const byOwner = countBy(live, ownerOf);
  const plural = (n) => (n === 1 ? 'entry' : 'entries');
  const owners = [...byOwner].map(([owner, n]) => `${owner} ${n}`).join(', ');
  const detail = `${live.length} ${plural(live.length)} in this home and project${owners ? `: ${owners}` : ''}`;

  const lines = [];
  for (const [owner, n] of byOwner) {
    const events = [...countBy(live.filter((entry) => ownerOf(entry) === owner), (entry) => entry.event)];
    lines.push(`${owner}: ${events.map(([event, count]) => `${event} ${count}`).join(', ')}`);
    const known = KNOWN_OWNERS.includes(owner) || live.some((entry) => entry.plugin === owner);
    if (!known) lines.push(`warning: ${n} ${plural(n)} owned by "${owner}", which neither js-harness, its stack nor an enabled plugin installs`);
  }
  const ours = byOwner.get('js-harness') ?? 0;
  if (ours > HOOK_ENTRY_LIMIT) {
    lines.push(`warning: js-harness has ${ours} entries in this home and project, over the limit of ${HOOK_ENTRY_LIMIT}, which is what this copy writes: an install of another version, or an entry added by hand (js-harness sync writes them again)`);
  }

  if (!own) return { name: 'hook entries', pass: true, info: true, detail, lines };
  const installed = deps.installed ?? installEntries();
  const over = installed.length > HOOK_ENTRY_LIMIT;
  lines.unshift(`install writes ${installed.length} ${plural(installed.length)} (limit ${HOOK_ENTRY_LIMIT})${over ? ': one more process on every matching event of every session; lower the count, or raise HOOK_ENTRY_LIMIT in bin/lib/hook-count.mjs with why' : ''}`);
  return { name: 'hook entries', pass: !over, info: false, detail, lines };
}
