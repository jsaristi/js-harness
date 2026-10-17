// What an arm of one component takes out of the current arm's home (G2 of `odd/tasks/future-model-protocol.md`,
// C3a): the files and keys of each named component, after the template is seeded into a trial's home, and nothing
// else. Zero deps, plain Node.
//
// Components are disjoint, so a pair is the sum of its two: `skills` and `hooks` leave js-harness's own skill
// folders and hook entries, which are the `js-harness` component. A component the home does not hold is refused,
// because its arm would be the current arm under another name. `project` takes nothing out of the home: its arm
// skips `js-harness init` in the workspace, which the seed does (`evals/home.mjs`).
//
// Built here: what a path or a JSON key holds, the blocks of the global instruction file, cut by their marker
// lines, and Codex's plugins, MCP servers and hook trust, which are tables of its `config.toml`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { components as fileComponents } from '../bin/lib/manifest.mjs';
import { ArmError, parseArm } from './arms.mjs';
import { scanToml, startsWith, withoutTables } from './codex-toml.mjs';

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

/** The JSON file `rel` of the home, or `undefined` when it holds none. */
function readJson(root, rel) {
  if (!exists(root, rel)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(full(root, rel), 'utf8'));
  } catch (err) {
    throw new ArmError(`${rel} is not valid JSON, so no component can be taken out of it: ${err.message}`);
  }
}

/** An edit of the JSON file `rel` when `mutate` changes it: the edited value, to be written as it is. */
function edit(root, rel, mutate) {
  const json = readJson(root, rel);
  return isObject(json) && mutate(json) ? [{ write: rel, json }] : [];
}

const CONFIG_TOML = '.codex/config.toml';
const cannotCut = (how) => new ArmError(`${CONFIG_TOML} ${how}, which an arm cannot take out whole`);

/** A rewrite of Codex's `config.toml` by `rewrite(text)` when it changes the text. A line the scan cannot read is
 * an `ArmError` too: the arm would be cut on a guess. */
function tomlEdit(root, rewrite) {
  if (!exists(root, CONFIG_TOML)) return [];
  const before = fs.readFileSync(full(root, CONFIG_TOML), 'utf8');
  let after;
  try {
    after = rewrite(before);
  } catch (err) {
    throw err instanceof ArmError ? err : new ArmError(err.message);
  }
  return after === before ? [] : [{ text: CONFIG_TOML, content: after }];
}

// The engram MCP server's instruction files, by the key of `config.toml` that names each: they go with
// `mcp-engram`, since nothing else reads them.
const ENGRAM_FILES = { model_instructions_file: 'engram-instructions.md', experimental_compact_prompt_file: 'engram-compact-prompt.md' };

/** `toml` with `enabled = true` turned to `false` in the table of each plugin called `name` (`[plugins."<name>@<marketplace>"]`),
 * the rest of the line kept. A plugin reached through dotted keys or an inline table is refused. */
function switchOffPlugin(toml, name) {
  const ours = (parts) => parts[0] === 'plugins' && parts.length > 1 && parts[1]?.split('@')[0] === name;
  const out = [];
  for (const { text, table, key } of scanToml(toml.split(/(?<=\n)/))) {
    if (key) {
      const whole = [...table, ...key.parts];
      if ((ours(whole) && table.length < 2) || (whole.length === 1 && whole[0] === 'plugins')) throw cannotCut(`declares a plugin through dotted keys or an inline table (${whole.join('.')})`);
      if (table.length === 2 && ours(table) && key.parts.length === 1 && key.parts[0] === 'enabled' && /^\s*true\s*(#.*)?$/.test(key.rest.trimEnd())) {
        out.push(text.replace(/(=\s*)true/, '$1false'));
        continue;
      }
    }
    out.push(text);
  }
  return out.join('');
}

// Codex keys the trust of a hook by its place: `[hooks.state.'<.codex>/hooks.json:<event>:<group>:<hook>']`, with
// the event in snake case and the group the entry's index in the event's list. In the template the `.codex` part is
// a placeholder that stands for the whole path to it, so nothing comes before it (`evals/codex-home.mjs`); a
// plugin's own hooks.json lies deeper and is not this one.
const TRUST = /^(?:.*[\\/])?(?:\.codex|@@TRIAL_CODEX_HOME:\w+@@)[\\/]+hooks\.json:([a-z_]+):(\d+):(\d+)$/i;
const snake = (event) => event.replace(/(?<=[a-z0-9])([A-Z])/g, '_$1').toLowerCase();

/** Where each group of each event of `hooksJson` goes once only the entries `keep` takes stay: its new index, or
 * -1, by snake-case event. */
function groupMoves(hooksJson, keep) {
  const moves = {};
  for (const [event, entries] of Object.entries(isObject(hooksJson?.hooks) ? hooksJson.hooks : {})) {
    if (!Array.isArray(entries)) continue;
    let next = 0;
    moves[snake(event)] = entries.map((entry) => (keep(entry) ? next++ : -1));
  }
  return moves;
}

/** `toml` with the trust of each hook `moves` drops taken out (its whole table), and that of each hook it moves
 * renamed to the new place, the hash kept: the hooks an arm keeps stay trusted, and no trust is left for a hook
 * that is gone. Trust for a place hooks.json does not hold is left as it is. A trust spelled through dotted keys or
 * an inline table is refused. */
function remapTrust(toml, moves) {
  const out = [];
  let dropping = false;
  for (const { text, table, header, key } of scanToml(toml.split(/(?<=\n)/))) {
    if (header) {
      dropping = false;
      const place = header.length === 3 && header[0] === 'hooks' && header[1] === 'state' ? TRUST.exec(header[2]) : null;
      const to = place ? moves[place[1]]?.[Number(place[2])] : undefined;
      if (to === -1) {
        dropping = true;
        continue;
      }
      if (to !== undefined && to !== Number(place[2])) {
        const old = `:${place[1]}:${place[2]}:${place[3]}`;
        const at = text.lastIndexOf(old);
        if (at === -1) throw cannotCut(`spells the trust of ${place[1]}:${place[2]}:${place[3]} with escapes`);
        out.push(`${text.slice(0, at)}:${place[1]}:${to}:${place[3]}${text.slice(at + old.length)}`);
        continue;
      }
      out.push(text);
      continue;
    }
    if (dropping) continue;
    if (key) {
      const whole = [...table, ...key.parts];
      const hidden = whole.length < 3 ? startsWith(['hooks', 'state'], whole) : whole[0] === 'hooks' && whole[1] === 'state' && table.length < 3;
      if (hidden) throw cannotCut(`declares hook trust through dotted keys or an inline table (${whole.slice(0, 2).join('.')})`);
    }
    out.push(text);
  }
  return out.join('');
}

/** The edits of a Codex arm that keeps only the hook entries `keep` takes: hooks.json, and the trust in
 * `config.toml` of the hooks that move or go. */
function codexHookEdits(root, keep) {
  const hooksFile = HOSTS.codex.hooksFile;
  const moves = groupMoves(readJson(root, hooksFile), keep);
  return [
    ...edit(root, hooksFile, (json) => keepHooks(json, keep)),
    ...tomlEdit(root, (text) => remapTrust(text, moves)),
  ];
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
  const hookEdits = (keep) => (agent === 'codex' ? codexHookEdits(root, keep) : edit(root, host.hooksFile, (json) => keepHooks(json, keep)));
  switch (id) {
    case 'claude-md': return removal(root, '.claude/CLAUDE.md');
    case 'agents-md': return removal(root, '.codex/AGENTS.md');
    case 'agents': return removal(root, '.claude/agents');
    case 'skills': return children(root, `${host.dir}/skills`).filter((name) => !own.has(name)).map((name) => ({ remove: `${host.dir}/skills/${name}` }));
    case 'js-harness': return [
      ...children(root, `${host.dir}/skills`).filter((name) => own.has(name)).map((name) => ({ remove: `${host.dir}/skills/${name}` })),
      ...hookEdits((entry) => !isOwnHook(entry)),
    ];
    case 'hooks': return [
      ...(host.hookFolder ? removal(root, host.hookFolder) : []),
      ...(host.hookScripts ? children(root, host.dir).filter((name) => host.hookScripts.test(name)).map((name) => ({ remove: `${host.dir}/${name}` })) : []),
      ...hookEdits(isOwnHook),
    ];
    case 'output-style': return [
      ...removal(root, '.claude/output-styles'),
      ...edit(root, '.claude/settings.json', (json) => 'outputStyle' in json && delete json.outputStyle),
    ];
    case 'project': return [];
    default: break;
  }
  const name = id.slice(id.indexOf('-') + 1);
  if (agent === 'codex' && id.startsWith('plugin-')) return tomlEdit(root, (text) => switchOffPlugin(text, name));
  if (agent === 'codex' && id.startsWith('mcp-')) {
    const engram = name === 'engram';
    return [
      ...tomlEdit(root, (text) => withoutTables(text, {
        tables: [['mcp_servers', name]],
        keys: (key, rest) => engram && Object.hasOwn(ENGRAM_FILES, key) && rest.includes(ENGRAM_FILES[key]),
        refuse: cannotCut,
      })),
      ...(engram ? Object.values(ENGRAM_FILES).flatMap((file) => removal(root, `.codex/${file}`)) : []),
    ];
  }
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
 * hold, or that it cannot cut for certain; reads only. `project` is always held: it is the workspace's, not the home's. */
export function checkWithout(root, components, agent) {
  for (const id of components) {
    parseArm(`current-without-${id}`, agent);
    if (id !== 'project' && piecesOf(root, id, agent).length === 0) {
      throw new ArmError(`${id} is not in the current arm's home, so an arm without it would be the current arm under another name`);
    }
  }
}

/** The SHA-256 of what taking `components` out of the template payload in `root` does: each path removed, and each
 * file rewritten with the digest of its new bytes as `settle(rel, bytes)` reads them (the fingerprint's own reading,
 * so a counter Claude Code keeps beside the MCP servers does not move it). A run pins it per arm, so a resume whose
 * cut changed, by a template edit or by this module's code, is another measurement. Each component is read against
 * the template as it is, not after the one before it: the digest moves whenever either input does, which is what a
 * pin needs. Reads only. */
export function withoutDigest(root, components, agent, settle = (rel, bytes) => bytes) {
  const hash = crypto.createHash('sha256');
  for (const id of components) {
    hash.update(`component\0${id}\n`);
    for (const piece of piecesOf(root, id, agent)) {
      if (piece.remove) hash.update(`remove\0${piece.remove}\n`);
      else {
        const rel = piece.text ?? piece.write;
        const bytes = piece.text ? piece.content : `${JSON.stringify(piece.json, null, 2)}\n`;
        hash.update(`write\0${rel}\0${crypto.createHash('sha256').update(settle(rel, bytes)).digest('hex')}\n`);
      }
    }
  }
  return hash.digest('hex');
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
