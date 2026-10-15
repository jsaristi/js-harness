// What an arm of one component takes out of the current arm's home (G2 of `odd/tasks/future-model-protocol.md`,
// C3a): the files and keys of each named component, after the template is seeded into a trial's home, and nothing
// else. Zero deps, plain Node.
//
// Components are disjoint, so a pair is the sum of its two: `skills` and `hooks` leave js-harness's own skill
// folders and hook entries, which are the `js-harness` component. A component the home does not hold is refused,
// because its arm would be the current arm under another name. `project` takes nothing out of the home: its arm
// skips `js-harness init` in the workspace, which the seed does (`evals/home.mjs`).
//
// Built here: what a path or a JSON key holds, and the blocks of the global instruction file, cut by their marker
// lines. Refused until C3c: Codex's plugins and MCP servers, which are TOML tables.
import fs from 'node:fs';
import path from 'node:path';
import { components as fileComponents } from '../bin/lib/manifest.mjs';
import { ArmError, parseArm } from './arms.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const HOSTS = {
  claude: { dir: '.claude', instructions: '.claude/CLAUDE.md', hooksFile: '.claude/settings.json', hookFolder: '.claude/hooks' },
  codex: { dir: '.codex', instructions: '.codex/AGENTS.md', hooksFile: '.codex/hooks.json', hookScripts: /\.(ps1|sh)$/ },
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

// gentle-ai writes each of its sections of the global instruction file between an opening and a closing marker
// line, and one may hold another (`remote-authorization` sits inside `agent-routing`). Other markers
// (`authority-first-terminal-procedure:start`) are text of the block they sit in.
const MARKER = /^\s*<!--\s*(\/?)gentle-ai:([a-z0-9-]+)\s*-->\s*$/;

/** The top-level blocks of `lines` as `{ name: { from, to } }`, line indexes inclusive. A closing marker that
 * does not close the block last opened, a top-level block twice or a block left open is an `ArmError` naming the
 * line: cut on a guess, an arm could lose half of another block or keep half of its own. */
function blocksOf(lines, rel) {
  const blocks = {};
  const stack = [];
  lines.forEach((line, index) => {
    const marker = MARKER.exec(line);
    if (!marker) return;
    const [, closing, name] = marker;
    if (!closing) {
      stack.push({ name, from: index });
      return;
    }
    const top = stack.pop();
    if (top?.name !== name) throw new ArmError(`${rel} line ${index + 1} closes gentle-ai:${name}, ${top ? `but gentle-ai:${top.name} is the block open there` : 'which is not open'}, so its blocks cannot be cut for certain`);
    if (stack.length > 0) return;
    if (Object.hasOwn(blocks, name)) throw new ArmError(`${rel} holds the block gentle-ai:${name} twice (line ${blocks[name].from + 1} and line ${top.from + 1}), so which one an arm takes out is a guess`);
    blocks[name] = { from: top.from, to: index };
  });
  if (stack.length > 0) throw new ArmError(`${rel} line ${stack[0].from + 1} opens gentle-ai:${stack[0].name}, which is not closed, so its blocks cannot be cut for certain`);
  return blocks;
}

/** A rewrite of the instruction file `rel` without the lines `drop(index, blocks)` takes, when one of them is not
 * blank (blank lines alone are no component); the file's own line endings kept. */
function cutLines(root, rel, drop) {
  if (!exists(root, rel)) return [];
  const text = fs.readFileSync(full(root, rel), 'utf8');
  const lines = text.split(/\r?\n/);
  const blocks = blocksOf(lines, rel);
  const dropped = lines.map((line, index) => drop(index, blocks));
  if (!lines.some((line, index) => dropped[index] && line.trim() !== '')) return [];
  return [{ text: rel, content: lines.filter((line, index) => !dropped[index]).join(text.includes('\r\n') ? '\r\n' : '\n') }];
}

const within = (block, index) => block !== undefined && index >= block.from && index <= block.to;

/** What taking `id` out of the home in `root` means for `agent`: a list of removals and edits, empty when the
 * home does not hold it. */
function piecesOf(root, id, agent) {
  const host = HOSTS[agent];
  const own = ownSkills(host.dir);
  if (id.startsWith('gentle-ai-')) {
    const name = id.slice('gentle-ai-'.length);
    return cutLines(root, host.instructions, (index, blocks) => within(blocks[name], index));
  }
  if (id === 'claude-md-own') return cutLines(root, host.instructions, (index, blocks) => !Object.values(blocks).some((block) => within(block, index)));
  if (agent === 'codex' && /^(plugin|mcp)-/.test(id)) throw new ArmError(`${id} is a table of Codex's config.toml, which is not built yet (C3c of G2)`);
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
      else if (piece.text) fs.writeFileSync(full(root, piece.text), piece.content);
      else fs.writeFileSync(full(root, piece.write), `${JSON.stringify(piece.json, null, 2)}\n`);
    }
  }
}
