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
import { cutSpans, tiesOf } from '../bin/lib/rules-coverage.mjs';
import { RULES } from '../bin/lib/rules-data.mjs';
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

/** The texts js-harness writes into the home under `host`: the instructions file, its skills and its output style. */
const ownTexts = (host) => [host.instructions, ...fileComponents
  .map((component) => component.target('/').split(/[\\/]/).filter(Boolean))
  .filter((parts) => parts[0] === host.dir)
  .map((parts) => parts.join('/'))];

/** `text` without each span (`cutSpans`) tied to the rule `id`, the spaces after it with it, and the line break of a
 * line it leaves empty; `null` when no span is tied to it. */
function withoutRule(text, id) {
  const cuts = cutSpans(text).filter((span) => tiesOf(span.text, RULES).includes(id));
  if (cuts.length === 0) return null;
  let out = '';
  let at = 0;
  for (const { start, end } of cuts) {
    let to = end;
    while (to < text.length && (text[to] === ' ' || text[to] === '\t')) to += 1;
    out += text.slice(at, start);
    const tail = out.slice(out.lastIndexOf('\n') + 1);
    if (tail.trim() === '' && (to === text.length || text[to] === '\r' || text[to] === '\n')) {
      out = out.slice(0, out.length - tail.length);
      if (text[to] === '\r') to += 1;
      if (text[to] === '\n') to += 1;
    }
    at = to;
  }
  return out + text.slice(at);
}

/** The rewrites that take the rule `id`'s text out of what js-harness wrote into the home in `root`. */
function rulePieces(root, id, host) {
  if (!RULES.some((rule) => rule.id === id && !Object.hasOwn(rule, 'retired'))) {
    throw new ArmError(`rule-${id}: ${id} is not a live rule of bin/lib/rules-data.mjs`);
  }
  return ownTexts(host).filter((rel) => exists(root, rel)).flatMap((rel) => {
    const content = withoutRule(fs.readFileSync(full(root, rel), 'utf8'), id);
    return content === null ? [] : [{ text: rel, content }];
  });
}

/** What taking `id` out of the home in `root` means for `agent`: a list of removals and edits, empty when the
 * home does not hold it. */
function piecesOf(root, id, agent) {
  const host = HOSTS[agent];
  const own = ownSkills(host.dir);
  if (id.startsWith('gentle-ai-')) {
    const name = id.slice('gentle-ai-'.length);
    return cutLines(root, host.instructions, (index, blocks) => within(blocks[name], index));
  }
  if (id.startsWith('rule-')) return rulePieces(root, id.slice('rule-'.length), host);
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

/** The `.md` files at or below `rel` of the home, sorted. */
function markdownFiles(root, rel) {
  if (!fs.statSync(full(root, rel), { throwIfNoEntry: false })?.isDirectory()) return rel.endsWith('.md') ? [rel] : [];
  return children(root, rel).flatMap((name) => markdownFiles(root, `${rel}/${name}`));
}

/** The front matter of a Markdown `text` and the lines after it. */
function frontMatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { head: [], body: lines };
  const end = lines.indexOf('---', 1);
  return end < 0 ? { head: [], body: lines } : { head: lines.slice(1, end), body: lines.slice(end + 1) };
}

/** The `description` of a front matter, a plain, quoted or folded value, or `null`. */
function descriptionOf(head) {
  const index = head.findIndex((line) => /^description:/.test(line));
  if (index < 0) return null;
  let value = head[index].slice('description:'.length).trim();
  if (/^[>|][-+]?$/.test(value)) {
    const rest = head.slice(index + 1);
    const end = rest.findIndex((line) => !/^\s/.test(line));
    value = rest.slice(0, end < 0 ? rest.length : end).map((line) => line.trim()).join(' ');
  }
  return value.replace(/^(["'])(.*)\1$/, '$2').trim() || null;
}

/** The lines of `before` that `after` (the same lines with some taken out, in order) no longer holds. */
function droppedLines(before, after) {
  const kept = after.split(/\r?\n/);
  let next = 0;
  return before.split(/\r?\n/).filter((line) => {
    if (next < kept.length && kept[next] === line) {
      next += 1;
      return false;
    }
    return true;
  });
}

/** The placeholder the template writes for the real home in a path (`evals/home.mjs` takes it from here). */
export const HOME_TOKEN = '@@TRIAL_HOME@@';

/** The folders, relative to the home in `root`, that the plugin `name` is installed in, by the `installPath` of its
 * entries in `installed_plugins.json` under the home placeholder; an entry outside the home, or a folder the template
 * does not hold, gives none. */
function pluginFolders(root, name) {
  let installed;
  try {
    installed = JSON.parse(fs.readFileSync(full(root, '.claude/plugins/installed_plugins.json'), 'utf8'));
  } catch {
    return [];
  }
  return Object.entries(isObject(installed?.plugins) ? installed.plugins : {})
    .filter(([key, entries]) => key.split('@')[0] === name && Array.isArray(entries))
    .flatMap(([, entries]) => entries.map((entry) => entry?.installPath))
    .filter((install) => typeof install === 'string' && install.startsWith(HOME_TOKEN))
    .map((install) => install.slice(HOME_TOKEN.length).split(/[\\/]+/).filter(Boolean).join('/'))
    .filter((rel) => fs.statSync(full(root, rel), { throwIfNoEntry: false })?.isDirectory());
}

/** Whether the plugin folder `rel` declares an MCP server, in `.mcp.json` or in its `plugin.json`. */
function declaresServer(root, rel) {
  if (fs.existsSync(full(root, `${rel}/.mcp.json`))) return true;
  try {
    return isObject(JSON.parse(fs.readFileSync(full(root, `${rel}/.claude-plugin/plugin.json`), 'utf8')).mcpServers);
  } catch {
    return false;
  }
}

/** The description the model is sent of the Markdown file `rel` with `text`: that of a skill's `SKILL.md`, an agent
 * or a command, from its front matter, unless the front matter keeps it from the model
 * (`disable-model-invocation: true`); `null` for any other file. */
function sentDescription(rel, text) {
  const parts = rel.split('/');
  const listed = parts.includes('skills') ? parts.at(-1) === 'SKILL.md' : parts.includes('agents') || parts.includes('commands');
  if (!listed) return null;
  const { head } = frontMatter(text);
  return head.some((line) => /^disable-model-invocation:\s*true\s*$/.test(line)) ? null : descriptionOf(head);
}

/** The body of the output style the home in `root` selects (`outputStyle` in its `settings.json`, matched to a style's
 * `name` or its file's name, in any case) among the files `rels`; none selected or none matching gives no lines. */
function selectedStyleBody(root, rels) {
  let selected;
  try {
    selected = JSON.parse(fs.readFileSync(full(root, '.claude/settings.json'), 'utf8')).outputStyle;
  } catch {
    return [];
  }
  if (typeof selected !== 'string') return [];
  for (const rel of rels) {
    const { head, body } = frontMatter(fs.readFileSync(full(root, rel), 'utf8'));
    const name = head.find((line) => /^name:/.test(line))?.slice('name:'.length).trim().replace(/^(["'])(.*)\1$/, '$2');
    if ([name, path.basename(rel, '.md')].some((candidate) => candidate?.toLowerCase() === selected.toLowerCase())) return body;
  }
  return [];
}

/** What a request to the model carries of the component `id` when it is loaded, read from the home in `root`, for
 * the isolation probe (`evals/isolation-probe.mjs`) to tell an arm that holds it from one that does not:
 * `{ tools, lines, descriptions }`. `tools` are prefixes of the tool names Claude Code gives a server
 * (`mcp__<name>__`) or a plugin's servers (`mcp__plugin_<name>_`, only for a plugin that declares one); `lines` are the
 * lines of text the model is sent whole, those the cut takes out of the instructions file and the selected output
 * style's body; `descriptions` are what it is sent of a skill, an agent or a command, a plugin's included, the
 * `description` of its front matter, not its body. Any other file (a README, a hook's notes) is sent nothing of. A
 * component the model is sent nothing of (hooks, the project) has all three empty, and the probe can only say so.
 * Reads only. */
export function withoutEvidence(root, id, agent) {
  const name = id.slice(id.indexOf('-') + 1);
  const plugins = agent === 'claude' && id.startsWith('plugin-') ? pluginFolders(root, name) : [];
  const tools = id.startsWith('mcp-') ? [`mcp__${name}__`] : plugins.some((rel) => declaresServer(root, rel)) ? [`mcp__plugin_${name}_`] : [];
  const lines = [];
  const descriptions = [];
  const read = (rel) => fs.readFileSync(full(root, rel), 'utf8');
  for (const piece of piecesOf(root, id, agent)) {
    if (piece.text) {
      lines.push(...droppedLines(read(piece.text), piece.content));
      continue;
    }
    const files = piece.remove ? markdownFiles(root, piece.remove) : [];
    for (const rel of files) {
      const parts = rel.split('/');
      if (parts.at(-1) === 'CLAUDE.md' || parts.at(-1) === 'AGENTS.md') lines.push(...read(rel).split(/\r?\n/));
      else if (!parts.includes('output-styles')) descriptions.push(sentDescription(rel, read(rel)));
    }
    lines.push(...selectedStyleBody(root, files.filter((rel) => rel.split('/').includes('output-styles'))));
  }
  // A plugin's own dependencies are no skill of it, whatever their folders are called.
  for (const folder of plugins) descriptions.push(...markdownFiles(root, folder).filter((rel) => !rel.split('/').includes('node_modules')).map((rel) => sentDescription(rel, read(rel))));
  return { tools, lines, descriptions: descriptions.filter(Boolean).sort() };
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
