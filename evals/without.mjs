// What an arm of one component takes out of the current arm's home (G2 of `odd/tasks/future-model-protocol.md`,
// C3a): the files and keys of each named component, after the template is seeded into a trial's home, and nothing
// else. Zero deps, plain Node.
//
// Components are disjoint, so a pair is the sum of its two: `skills` and `hooks` leave js-harness's own skill
// folders and hook entries, which are the `js-harness` component. A component the home does not hold is refused,
// because its arm would be the current arm under another name. `project` takes nothing out of the home: its arm
// skips `js-harness init` in the workspace, which the seed does (`evals/home.mjs`).
//
// Built here: what a path or a JSON key holds. Refused until C3b: the blocks of the global instruction file, cut
// by their marker lines, and Codex's plugins and MCP servers, which are TOML tables.
import fs from 'node:fs';
import path from 'node:path';
import { components as fileComponents } from '../bin/lib/manifest.mjs';
import { ArmError, parseArm } from './arms.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const HOSTS = {
  claude: { dir: '.claude', hooksFile: '.claude/settings.json', hookFolder: '.claude/hooks' },
  codex: { dir: '.codex', hooksFile: '.codex/hooks.json', hookScripts: /\.(ps1|sh)$/ },
};

/** The skill folders js-harness installs under `dir` (`.claude` or `.codex`), by name. */
const ownSkills = (dir) => new Set(fileComponents
  .map((component) => component.target('/').split(/[\\/]/).filter(Boolean))
  .filter((parts) => parts[0] === dir && parts[1] === 'skills')
  .map((parts) => parts[2]));

/** A hook entry js-harness installed: every command of it runs js-harness (its doctor, resume, pause, guard). */
const isOwnHook = (entry) => Array.isArray(entry?.hooks) && entry.hooks.length > 0 && entry.hooks.every((h) => /^js-harness\s/.test(h?.command ?? ''));

/** Keeps only the entries of `json.hooks` that `keep` takes; an event left empty goes, and so does `hooks` when
 * nothing is left in it. Whether anything changed. */
function keepHooks(json, keep) {
  if (!isObject(json.hooks)) return false;
  let changed = false;
  for (const [event, entries] of Object.entries(json.hooks)) {
    if (!Array.isArray(entries)) continue;
    const kept = entries.filter(keep);
    if (kept.length === entries.length) continue;
    changed = true;
    if (kept.length > 0) json.hooks[event] = kept;
    else delete json.hooks[event];
  }
  if (changed && Object.keys(json.hooks).length === 0) delete json.hooks;
  return changed;
}

const full = (root, rel) => path.join(root, ...rel.split('/'));
const exists = (root, rel) => fs.existsSync(full(root, rel));
const children = (root, rel) => (fs.statSync(full(root, rel), { throwIfNoEntry: false })?.isDirectory() ? fs.readdirSync(full(root, rel)).sort() : []);

/** A removal of `rel` when the home holds it. */
const removal = (root, rel) => (exists(root, rel) ? [{ remove: rel }] : []);

/** An edit of the JSON file `rel` when `mutate` changes it: the edited value, to be written as it is. */
function edit(root, rel, mutate) {
  if (!exists(root, rel)) return [];
  let json;
  try {
    json = JSON.parse(fs.readFileSync(full(root, rel), 'utf8'));
  } catch (err) {
    throw new ArmError(`${rel} is not valid JSON, so no component can be taken out of it: ${err.message}`);
  }
  return isObject(json) && mutate(json) ? [{ write: rel, json }] : [];
}

const MARKER_BLOCKS = /^(claude-md-own|gentle-ai-.+)$/;

/** What taking `id` out of the home in `root` means for `agent`: a list of removals and JSON edits, empty when
 * the home does not hold it. */
function piecesOf(root, id, agent) {
  const host = HOSTS[agent];
  const own = ownSkills(host.dir);
  if (MARKER_BLOCKS.test(id)) throw new ArmError(`${id} is cut out of the global instruction file by its marker lines, which are not built yet (C3b of G2)`);
  if (agent === 'codex' && /^(plugin|mcp)-/.test(id)) throw new ArmError(`${id} is a table of Codex's config.toml, which is not built yet (C3b of G2)`);
  switch (id) {
    case 'claude-md': return removal(root, '.claude/CLAUDE.md');
    case 'agents-md': return removal(root, '.codex/AGENTS.md');
    case 'agents': return removal(root, '.claude/agents');
    case 'skills': return children(root, `${host.dir}/skills`).filter((name) => !own.has(name)).map((name) => ({ remove: `${host.dir}/skills/${name}` }));
    case 'js-harness': return [
      ...children(root, `${host.dir}/skills`).filter((name) => own.has(name)).map((name) => ({ remove: `${host.dir}/skills/${name}` })),
      ...edit(root, host.hooksFile, (json) => keepHooks(json, (entry) => !isOwnHook(entry))),
    ];
    case 'hooks': return [
      ...(host.hookFolder ? removal(root, host.hookFolder) : []),
      ...(host.hookScripts ? children(root, host.dir).filter((name) => host.hookScripts.test(name)).map((name) => ({ remove: `${host.dir}/${name}` })) : []),
      ...edit(root, host.hooksFile, (json) => keepHooks(json, isOwnHook)),
    ];
    case 'output-style': return [
      ...removal(root, '.claude/output-styles'),
      ...edit(root, '.claude/settings.json', (json) => 'outputStyle' in json && delete json.outputStyle),
    ];
    case 'project': return [];
    default: break;
  }
  const name = id.slice(id.indexOf('-') + 1);
  if (id.startsWith('plugin-')) {
    // Switched off, not deleted: its files stay where `installed_plugins.json` says they are, so Claude Code has no
    // missing plugin to fetch again at startup.
    return edit(root, '.claude/settings.json', (json) => {
      const keys = isObject(json.enabledPlugins) ? Object.keys(json.enabledPlugins).filter((key) => key.split('@')[0] === name && json.enabledPlugins[key] === true) : [];
      for (const key of keys) json.enabledPlugins[key] = false;
      return keys.length > 0;
    });
  }
  if (id.startsWith('mcp-')) return edit(root, '.claude/.claude.json', (json) => isObject(json.mcpServers) && Object.hasOwn(json.mcpServers, name) && delete json.mcpServers[name]);
  throw new ArmError(`${id} is not a component this module knows how to take out`);
}

/** Refuses, with an `ArmError`, any of `components` that is not one of `agent`'s, that the home in `root` does not
 * hold, or that is not built yet; reads only. `project` is always held: it is the workspace's, not the home's. */
export function checkWithout(root, components, agent) {
  for (const id of components) {
    parseArm(`current-without-${id}`, agent);
    if (id !== 'project' && piecesOf(root, id, agent).length === 0) {
      throw new ArmError(`${id} is not in the current arm's home, so an arm without it would be the current arm under another name`);
    }
  }
}

/** Takes `components` out of the home in `root`, one after the other, once `checkWithout` has passed for all of
 * them: a refused component leaves the home untouched. */
export function applyWithout(root, components, agent) {
  checkWithout(root, components, agent);
  for (const id of components) {
    for (const piece of piecesOf(root, id, agent)) {
      if (piece.remove) fs.rmSync(full(root, piece.remove), { recursive: true, force: true });
      else fs.writeFileSync(full(root, piece.write), `${JSON.stringify(piece.json, null, 2)}\n`);
    }
  }
}
