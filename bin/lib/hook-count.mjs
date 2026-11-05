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

// Programs that run a script: the owner is the script's top folder, not the program.
const RUNNERS = ['node', 'npm', 'npx', 'pnpm'];

/** The hook entries `install` writes into Claude Code's settings, `{ event, command }` each, read from the
 * manifest's entry components so the count is the one `install` acts on. */
export function installEntries() {
  return entryComponents
    .filter((component) => component.pointer[0] === 'hooks')
    .flatMap((component) => component.entry().hooks.map((hook) => ({ event: component.pointer[1], command: hook.command })));
}

/** Every hook entry Claude Code runs for the project at `cwd`, from the home's and the project's settings and the
 * enabled plugins (./payload.mjs). */
export function liveEntries(home, cwd) {
  return claudeHookEntries(home, cwd);
}

/** The owner of an entry: its plugin's id, else the name of the program its command starts, without folder or
 * extension (`codegraph.cmd` is `codegraph`); for a script runner, the script's top folder. */
export function ownerOf({ command, plugin }) {
  if (plugin) return plugin;
  const words = command.trim().match(/"[^"]*"|\S+/g) ?? [''];
  const unquote = (word) => word.replace(/^"|"$/g, '');
  const program = path.basename(unquote(words[0])).replace(/\.(cmd|exe|bat|ps1|sh|mjs|js)$/i, '');
  if (!RUNNERS.includes(program.toLowerCase())) return program;
  const script = words.slice(1).map(unquote).find((word) => !word.startsWith('-'));
  if (!script) return program;
  return script.replace(/^\.\//, '').split(/[\\/]/)[0];
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
    lines.push(`warning: js-harness has ${ours} entries in this home, over the ${HOOK_ENTRY_LIMIT} this copy writes: an install of another version, or an entry added by hand (js-harness sync writes them again)`);
  }

  if (!own) return { name: 'hook entries', pass: true, info: true, detail, lines };
  const installed = deps.installed ?? installEntries();
  const over = installed.length > HOOK_ENTRY_LIMIT;
  lines.unshift(`install writes ${installed.length} ${plural(installed.length)} (limit ${HOOK_ENTRY_LIMIT})${over ? ': one more process on every matching event of every session; lower the count, or raise HOOK_ENTRY_LIMIT in bin/lib/hook-count.mjs with why' : ''}`);
  return { name: 'hook entries', pass: !over, info: false, detail, lines };
}
